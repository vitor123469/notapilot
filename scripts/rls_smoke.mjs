import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

async function loadSupabaseClient() {
  try {
    return await import("@supabase/supabase-js");
  } catch {
    const localModule = resolve(
      process.cwd(),
      "apps/web/node_modules/@supabase/supabase-js/dist/index.mjs"
    );
    return await import(pathToFileURL(localModule).href);
  }
}

function parseEnvFile(content) {
  const parsed = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

async function loadEnv() {
  const envPath = resolve(process.cwd(), "apps/web/.env.local");
  let fileEnv = {};

  try {
    const content = await readFile(envPath, "utf8");
    fileEnv = parseEnvFile(content);
  } catch {
    // If .env.local doesn't exist, rely only on process.env.
  }

  const getEnv = (key) => process.env[key] || fileEnv[key] || "";

  return {
    supabaseUrl: getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

function assertOrThrow(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function randomSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

function createUserEmail(prefix) {
  return `rls-smoke-${prefix}-${randomSuffix()}@example.com`;
}

async function createSignedInUserClient({ createClient, supabaseUrl, supabaseAnonKey, label }) {
  const email = createUserEmail(label);
  const password = `Smoke_${randomSuffix()}_A!9z`;
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({
    email,
    password,
  });
  if (signUpError) {
    throw new Error(`Falha no signUp do usuário ${label}: ${signUpError.message}`);
  }

  const userId = signUpData.user?.id;
  assertOrThrow(Boolean(userId), `signUp do usuário ${label} não retornou user.id`);

  let sessionData = signUpData.session || null;
  if (!sessionData?.access_token) {
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      throw new Error(
        `Usuário ${label} sem sessão no signUp e signIn falhou: ${signInError.message}`
      );
    }
    sessionData = signInData.session || null;
  }

  assertOrThrow(
    Boolean(sessionData?.access_token && sessionData?.refresh_token),
    `Não foi possível obter sessão completa do usuário ${label}`
  );

  const { error: setSessionError } = await anonClient.auth.setSession({
    access_token: sessionData.access_token,
    refresh_token: sessionData.refresh_token,
  });
  if (setSessionError) {
    throw new Error(`Falha ao fixar sessão do usuário ${label}: ${setSessionError.message}`);
  }

  // Reuse the same client used for auth so PostgREST receives the active user session.
  return { email, userId, client: anonClient };
}

async function main() {
  const { createClient } = await loadSupabaseClient();
  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = await loadEnv();

  assertOrThrow(
    Boolean(supabaseUrl),
    "NEXT_PUBLIC_SUPABASE_URL ausente (process.env ou apps/web/.env.local)"
  );
  assertOrThrow(
    Boolean(supabaseAnonKey),
    "NEXT_PUBLIC_SUPABASE_ANON_KEY ausente (process.env ou apps/web/.env.local)"
  );

  const createdUsers = [];
  let userA;
  let userB;
  let tenantAId = "";
  let tenantBId = "";
  const adminClient = supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

  try {
    userA = await createSignedInUserClient({
      createClient,
      supabaseUrl,
      supabaseAnonKey,
      label: "a",
    });
    userB = await createSignedInUserClient({
      createClient,
      supabaseUrl,
      supabaseAnonKey,
      label: "b",
    });

    createdUsers.push(userA.userId, userB.userId);

    tenantAId = crypto.randomUUID();
    tenantBId = crypto.randomUUID();

    const { error: tenantAError } = await userA.client.from("tenants").insert({
      id: tenantAId,
      name: `Tenant A ${randomSuffix()}`,
      created_by: userA.userId,
    });
    if (tenantAError) {
      throw new Error(`Falha ao criar tenant A: ${tenantAError.message}`);
    }

    const { error: tenantBError } = await userB.client.from("tenants").insert({
      id: tenantBId,
      name: `Tenant B ${randomSuffix()}`,
      created_by: userB.userId,
    });
    if (tenantBError) {
      throw new Error(`Falha ao criar tenant B: ${tenantBError.message}`);
    }

    const { error: memberAError } = await userA.client.from("tenant_members").insert({
      tenant_id: tenantAId,
      user_id: userA.userId,
      role: "owner",
    });
    if (memberAError && !adminClient) {
      throw new Error(
        `Falha ao criar membership owner A: ${memberAError.message}. ` +
          "Sem SUPABASE_SERVICE_ROLE_KEY para fallback."
      );
    }
    if (memberAError && adminClient) {
      const { error: adminMemberAError } = await adminClient.from("tenant_members").insert({
        tenant_id: tenantAId,
        user_id: userA.userId,
        role: "owner",
      });
      if (adminMemberAError) {
        throw new Error(
          `Falha no bootstrap de membership A (user+admin): ${adminMemberAError.message}`
        );
      }
      console.warn(
        "Aviso: bootstrap policy de tenant_members bloqueou User A; aplicado fallback admin."
      );
    }

    const { error: memberBError } = await userB.client.from("tenant_members").insert({
      tenant_id: tenantBId,
      user_id: userB.userId,
      role: "owner",
    });
    if (memberBError && !adminClient) {
      throw new Error(
        `Falha ao criar membership owner B: ${memberBError.message}. ` +
          "Sem SUPABASE_SERVICE_ROLE_KEY para fallback."
      );
    }
    if (memberBError && adminClient) {
      const { error: adminMemberBError } = await adminClient.from("tenant_members").insert({
        tenant_id: tenantBId,
        user_id: userB.userId,
        role: "owner",
      });
      if (adminMemberBError) {
        throw new Error(
          `Falha no bootstrap de membership B (user+admin): ${adminMemberBError.message}`
        );
      }
      console.warn(
        "Aviso: bootstrap policy de tenant_members bloqueou User B; aplicado fallback admin."
      );
    }

    const companyAId = crypto.randomUUID();
    const { error: companyAInsertError } = await userA.client.from("companies").insert({
      id: companyAId,
      tenant_id: tenantAId,
      legal_name: `Empresa A ${randomSuffix()}`,
      trade_name: "Empresa A",
      cnpj: `${Date.now()}0001`,
    });
    if (companyAInsertError) {
      throw new Error(`Falha ao criar company do Tenant A: ${companyAInsertError.message}`);
    }

    const { data: tenantsA, error: tenantsAError } = await userA.client.from("tenants").select("id");
    if (tenantsAError) {
      throw new Error(`Falha no select tenants (User A): ${tenantsAError.message}`);
    }
    const tenantIdsA = (tenantsA || []).map((row) => row.id);
    assertOrThrow(tenantIdsA.includes(tenantAId), "User A não enxerga o próprio tenant");
    assertOrThrow(!tenantIdsA.includes(tenantBId), "User A enxerga tenant do User B");

    const { data: tenantsB, error: tenantsBError } = await userB.client.from("tenants").select("id");
    if (tenantsBError) {
      throw new Error(`Falha no select tenants (User B): ${tenantsBError.message}`);
    }
    const tenantIdsB = (tenantsB || []).map((row) => row.id);
    assertOrThrow(tenantIdsB.includes(tenantBId), "User B não enxerga o próprio tenant");
    assertOrThrow(!tenantIdsB.includes(tenantAId), "User B enxerga tenant do User A");

    const { data: companiesB, error: companiesBError } = await userB.client
      .from("companies")
      .select("id, tenant_id");
    if (companiesBError) {
      throw new Error(`Falha no select companies (User B): ${companiesBError.message}`);
    }
    const companyBSeesA = (companiesB || []).some(
      (row) => row.id === companyAId || row.tenant_id === tenantAId
    );
    assertOrThrow(!companyBSeesA, "User B enxerga company do Tenant A");

    const { error: forbiddenInsertError } = await userB.client.from("companies").insert({
      tenant_id: tenantAId,
      legal_name: `Empresa Invasora ${randomSuffix()}`,
      trade_name: "Invasora",
      cnpj: `${Date.now()}0002`,
    });
    assertOrThrow(
      Boolean(forbiddenInsertError),
      "User B conseguiu inserir company no Tenant A (RLS deveria bloquear)"
    );

    console.log("RLS_SMOKE_PASS");
  } finally {
    const cleanupErrors = [];

    if (userA && tenantAId) {
      const { error } = await userA.client.from("tenants").delete().eq("id", tenantAId);
      if (error) cleanupErrors.push(`Cleanup tenant A falhou: ${error.message}`);
    }
    if (userB && tenantBId) {
      const { error } = await userB.client.from("tenants").delete().eq("id", tenantBId);
      if (error) cleanupErrors.push(`Cleanup tenant B falhou: ${error.message}`);
    }

    if (adminClient) {
      if (tenantAId) {
        const { error } = await adminClient.from("tenants").delete().eq("id", tenantAId);
        if (error) cleanupErrors.push(`Falha admin ao deletar tenant A: ${error.message}`);
      }
      if (tenantBId) {
        const { error } = await adminClient.from("tenants").delete().eq("id", tenantBId);
        if (error) cleanupErrors.push(`Falha admin ao deletar tenant B: ${error.message}`);
      }

      for (const userId of createdUsers) {
        const { error } = await adminClient.auth.admin.deleteUser(userId);
        if (error) cleanupErrors.push(`Falha ao deletar usuário ${userId}: ${error.message}`);
      }
    } else if (createdUsers.length > 0) {
      console.warn("SUPABASE_SERVICE_ROLE_KEY ausente; usuários de smoke test foram mantidos.");
    }

    if (cleanupErrors.length > 0) {
      console.error("Problemas no cleanup:");
      for (const line of cleanupErrors) console.error(`- ${line}`);
    }
  }
}

main().catch((error) => {
  console.error("RLS_SMOKE_FAIL");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
