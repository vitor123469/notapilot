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
      const supabase = getSupabaseBrowser();
      setErrorMessage("");
      setStatusMessage("Aguardando sessão...");

      const validSession = await waitForSession();
      if (!validSession?.user) {
        setStatusMessage("Sessão não carregou.");
        setErrorMessage("Sessão não carregou.");
        return;
      }

      const userId = validSession.user.id;
      setStatusMessage("Verificando membership...");

      const { data: existingMember, error: memberCheckError } = await supabase
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (memberCheckError) {
        setErrorMessage(memberCheckError.message);
        return;
      }

      let tenantId = existingMember?.tenant_id ?? null;

      if (!tenantId) {
        setStatusMessage("Criando tenant e owner...");
        const { data: createdTenant, error: tenantCreateError } = await supabase
          .from("tenants")
          .insert({
            name: "Minha empresa",
            created_by: userId,
          })
          .select("id")
          .single();

        if (tenantCreateError) {
          setErrorMessage(tenantCreateError.message);
          return;
        }

        tenantId = createdTenant.id;

        const { error: memberCreateError } = await supabase.from("tenant_members").insert({
          tenant_id: tenantId,
          user_id: userId,
          role: "owner",
        });

        if (memberCreateError) {
          setErrorMessage(memberCreateError.message);
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
