"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getSupabaseBrowser } from "../../src/lib/supabase/browserClient";
import { useActiveTenant } from "../../src/lib/tenancy/useActiveTenant";

export function DashboardClient() {
  const router = useRouter();
  const { tenantId, isLoading: isTenantLoading, error: tenantError } = useActiveTenant();
  const [tenantName, setTenantName] = useState<string>("");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadTenant = useCallback(async () => {
    if (!tenantId) return;

    const supabase = getSupabaseBrowser();
    setLoadError("");
    setIsLoadingData(true);

    const { data: tenant, error } = await supabase.from("tenants").select("id, name").eq("id", tenantId).maybeSingle();

    if (error) {
      setLoadError("Não foi possível carregar os dados do tenant. Tente recarregar.");
      setIsLoadingData(false);
      return;
    }

    if (!tenant) {
      router.replace("/app/onboarding");
      return;
    }

    setTenantName(tenant.name);
    setIsLoadingData(false);
  }, [router, tenantId]);

  useEffect(() => {
    if (!tenantId) return;

    loadTenant().catch(() => {
      setLoadError("Não foi possível carregar os dados do tenant. Tente recarregar.");
      setIsLoadingData(false);
    });
  }, [loadTenant, tenantId]);

  if (isTenantLoading) {
    return (
      <main style={{ display: "grid", gap: 20 }}>
        <h1>Dashboard</h1>
        <p>Validando tenant ativo...</p>
      </main>
    );
  }

  if (tenantError) {
    return (
      <main style={{ display: "grid", gap: 20 }}>
        <h1>Dashboard</h1>
        <p style={{ color: "crimson", margin: 0 }}>{tenantError}</p>
        <button type="button" onClick={() => router.refresh()}>
          Recarregar
        </button>
      </main>
    );
  }

  if (!tenantId) {
    return (
      <main style={{ display: "grid", gap: 20 }}>
        <h1>Dashboard</h1>
        <p>
          Preparando tenant... <Link href="/app/onboarding">Ir para onboarding</Link>
        </p>
      </main>
    );
  }

  return (
    <main style={{ display: "grid", gap: 20 }}>
      <h1>Dashboard</h1>
      <section style={{ display: "grid", gap: 8 }}>
        <strong>Tenant ativo</strong>
        <span>{tenantName || "(sem nome)"}</span>
        <small>{tenantId}</small>
      </section>

      {isLoadingData ? <p>Carregando dados do tenant...</p> : null}
      {loadError ? (
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ color: "crimson", margin: 0 }}>{loadError}</p>
          <button type="button" onClick={() => loadTenant()}>
            Recarregar
          </button>
        </div>
      ) : null}

      <section style={{ display: "grid", gap: 10 }}>
        <h2>Empresas</h2>
        <p>Faça o gerenciamento completo das empresas em uma página dedicada.</p>
        <Link href="/app/companies">Gerenciar empresas</Link>
      </section>
    </main>
  );
}
