"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";

import { useSession } from "../../../src/lib/auth/useSession";
import { getSupabaseBrowser } from "../../../src/lib/supabase/browserClient";
import { setActiveTenantId } from "../../../src/lib/tenancy/activeTenant";

const SESSION_RETRY_MS = 300;
const SESSION_MAX_TRIES = 10;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSession(): Promise<Session | null> {
  const supabase = getSupabaseBrowser();
  for (let attempt = 0; attempt < SESSION_MAX_TRIES; attempt += 1) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) return session;
    await sleep(SESSION_RETRY_MS);
  }
  return null;
}

function getRestHeaders(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) throw new Error("Supabase env missing");
  return {
    url,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  };
}

export function OnboardingClient() {
  const router = useRouter();
  const { session, isLoading } = useSession();
  const [statusMessage, setStatusMessage] = useState("Preparando onboarding...");
  const [errorMessage, setErrorMessage] = useState("");
  const didRun = useRef(false);

  useEffect(() => {
    if (isLoading || didRun.current) return;
    didRun.current = true;

    const run = async () => {
      setErrorMessage("");
      setStatusMessage("Aguardando sessão...");

      const validSession = await waitForSession();
      if (!validSession?.user) {
        setStatusMessage("Sessão não carregou.");
        setErrorMessage("Sessão não carregou.");
        return;
      }

      const accessToken = validSession.access_token;
      const userId = validSession.user.id;
      const { url, headers } = getRestHeaders(accessToken);
      setStatusMessage("Verificando membership...");

      const memberCheckRes = await fetch(
        `${url}/rest/v1/tenant_members?select=tenant_id&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
        {
          method: "GET",
          headers,
        }
      );
      if (!memberCheckRes.ok) {
        const errorText = await memberCheckRes.text();
        setErrorMessage(`HTTP ${memberCheckRes.status}: ${errorText}`);
        return;
      }
      const existingMembers = (await memberCheckRes.json()) as Array<{ tenant_id: string }>;

      let tenantId = existingMembers[0]?.tenant_id ?? null;

      if (!tenantId) {
        setStatusMessage("Criando tenant e owner...");
        const createTenantRes = await fetch(`${url}/rest/v1/tenants?select=id`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: "Minha empresa",
            created_by: userId,
          }),
        });
        if (!createTenantRes.ok) {
          const errorText = await createTenantRes.text();
          setErrorMessage(`HTTP ${createTenantRes.status}: ${errorText}`);
          return;
        }
        const createdTenants = (await createTenantRes.json()) as Array<{ id: string }>;

        tenantId = createdTenants[0]?.id ?? null;
        if (!tenantId) {
          setErrorMessage("HTTP 500: resposta sem tenant_id");
          return;
        }

        const createMemberRes = await fetch(`${url}/rest/v1/tenant_members`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            tenant_id: tenantId,
            user_id: userId,
            role: "owner",
          }),
        });
        if (!createMemberRes.ok) {
          const errorText = await createMemberRes.text();
          setErrorMessage(`HTTP ${createMemberRes.status}: ${errorText}`);
          return;
        }
      }

      setActiveTenantId(tenantId);
      router.replace("/app");
    };

    run().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    });
  }, [isLoading, router]);

  if (isLoading) {
    return <p>Carregando sessão...</p>;
  }

  if (!session && !errorMessage) {
    return <p>Redirecionando para login...</p>;
  }

  return (
    <main>
      <h1 style={{ marginBottom: 12 }}>Onboarding</h1>
      <p>{statusMessage}</p>
      {errorMessage ? (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <p style={{ color: "crimson" }}>Erro no onboarding: {errorMessage}</p>
          <button onClick={() => router.push("/auth/login")}>Ir para login</button>
        </div>
      ) : null}
    </main>
  );
}
