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
      setErrorMessage("");
      setStatusMessage("Aguardando sessão...");

      const validSession = await waitForSession();
      if (!validSession?.user) {
        setStatusMessage("Sessão não carregou.");
        setErrorMessage("Sessão não carregou.");
        return;
      }

      const accessToken = validSession.access_token;
      setStatusMessage("Executando bootstrap...");
      const bootstrapRes = await fetch("/api/onboarding/bootstrap", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!bootstrapRes.ok) {
        const errorText = await bootstrapRes.text();
        setErrorMessage(`HTTP ${bootstrapRes.status}: ${errorText}`);
        return;
      }

      const bootstrapData = (await bootstrapRes.json()) as { tenantId?: string };
      const tenantId = bootstrapData.tenantId;
      if (!tenantId) {
        setErrorMessage("HTTP 500: resposta sem tenantId");
        return;
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
