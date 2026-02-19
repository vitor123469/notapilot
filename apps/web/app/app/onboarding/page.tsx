"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useSession } from "../../../src/lib/auth/useSession";
import { setActiveTenantId } from "../../../src/lib/tenancy/activeTenant";
import { createBrowserSupabaseClient } from "../../../src/lib/supabase/browserClient";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const { session, isLoading } = useSession();
  const [statusMessage, setStatusMessage] = useState("Preparando onboarding...");
  const [errorMessage, setErrorMessage] = useState("");
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (isLoading || !session || hasStartedRef.current) return;
    hasStartedRef.current = true;

    const run = async () => {
      const userId = session.user.id;
      setErrorMessage("");
      setStatusMessage("Verificando tenant...");

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
        setStatusMessage("Criando tenant inicial...");
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
  }, [isLoading, router, session, supabase]);

  if (isLoading) {
    return <p>Carregando sessão...</p>;
  }

  if (!session) {
    return <p>Redirecionando para login...</p>;
  }

  return (
    <main>
      <h1 style={{ marginBottom: 12 }}>Onboarding</h1>
      <p>{statusMessage}</p>
      {errorMessage ? (
        <p style={{ color: "crimson", marginTop: 12 }}>
          Erro no onboarding: {errorMessage}
        </p>
      ) : null}
    </main>
  );
}
