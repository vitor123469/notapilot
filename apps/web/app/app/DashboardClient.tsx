"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useSession } from "../../src/lib/auth/useSession";
import { getSupabaseBrowser } from "../../src/lib/supabase/browserClient";
import { getActiveTenantId } from "../../src/lib/tenancy/activeTenant";

export function DashboardClient() {
  const router = useRouter();
  const { session, isLoading } = useSession();
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>("");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/auth/login");
      return;
    }

    if (isLoading || !session) return;

    const tenantId = getActiveTenantId();
    if (!tenantId) {
      router.replace("/app/onboarding");
      return;
    }
    setActiveTenantIdState(tenantId);
  }, [isLoading, router, session]);

  useEffect(() => {
    if (!session || !activeTenantId) return;

    const load = async () => {
      const supabase = getSupabaseBrowser();
      setLoadError("");
      setIsLoadingData(true);

      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("id, name")
        .eq("id", activeTenantId)
        .maybeSingle();

      if (tenantError) {
        setLoadError(tenantError.message);
        setIsLoadingData(false);
        return;
      }

      if (!tenant) {
        router.replace("/app/onboarding");
        return;
      }

      setTenantName(tenant.name);
      setIsLoadingData(false);
    };

    load().catch((error) => {
      setLoadError(error instanceof Error ? error.message : String(error));
      setIsLoadingData(false);
    });
  }, [activeTenantId, router, session]);

  return (
    <main style={{ display: "grid", gap: 20 }}>
      <h1>Dashboard</h1>

      {!activeTenantId ? (
        <p>
          Preparando tenant... <Link href="/app/onboarding">Ir para onboarding</Link>
        </p>
      ) : (
        <section style={{ display: "grid", gap: 8 }}>
          <strong>Tenant ativo</strong>
          <span>{tenantName || "(sem nome)"}</span>
          <small>{activeTenantId}</small>
        </section>
      )}

      {isLoadingData ? <p>Carregando dados do tenant...</p> : null}
      {loadError ? <p style={{ color: "crimson" }}>{loadError}</p> : null}

      <section style={{ display: "grid", gap: 10 }}>
        <h2>Empresas</h2>
        <p>Faça o gerenciamento completo das empresas em uma página dedicada.</p>
        <Link href="/app/companies">Gerenciar empresas</Link>
      </section>
    </main>
  );
}
