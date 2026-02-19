"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useSession } from "../../src/lib/auth/useSession";
import type { Database } from "../../src/lib/supabase/db.types";
import { getBrowserSupabaseClient } from "../../src/lib/supabase/browserClient";
import { getActiveTenantId } from "../../src/lib/tenancy/activeTenant";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];

export function DashboardClient() {
  const router = useRouter();
  const { session, isLoading } = useSession();
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>("");
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [createError, setCreateError] = useState("");
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [legalName, setLegalName] = useState("");
  const [cnpj, setCnpj] = useState("");

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
      const supabase = getBrowserSupabaseClient();
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

      const { data: tenantCompanies, error: companiesError } = await supabase
        .from("companies")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: false });

      if (companiesError) {
        setLoadError(companiesError.message);
        setIsLoadingData(false);
        return;
      }

      setCompanies(tenantCompanies ?? []);
      setIsLoadingData(false);
    };

    load().catch((error) => {
      setLoadError(error instanceof Error ? error.message : String(error));
      setIsLoadingData(false);
    });
  }, [activeTenantId, router, session]);

  async function handleCreateCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");

    if (!activeTenantId) {
      setCreateError("Tenant ativo não encontrado.");
      return;
    }

    if (!legalName.trim() || !cnpj.trim()) {
      setCreateError("Preencha razão social e CNPJ.");
      return;
    }

    setIsCreatingCompany(true);
    const supabase = getBrowserSupabaseClient();
    const { error } = await supabase.from("companies").insert({
      tenant_id: activeTenantId,
      legal_name: legalName.trim(),
      cnpj: cnpj.trim(),
    });
    setIsCreatingCompany(false);

    if (error) {
      setCreateError(error.message);
      return;
    }

    setLegalName("");
    setCnpj("");

    const { data: tenantCompanies, error: companiesError } = await supabase
      .from("companies")
      .select("*")
      .eq("tenant_id", activeTenantId)
      .order("created_at", { ascending: false });

    if (companiesError) {
      setCreateError(companiesError.message);
      return;
    }

    setCompanies(tenantCompanies ?? []);
  }

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

      <section style={{ display: "grid", gap: 10 }}>
        <h2>Companies</h2>
        <form onSubmit={handleCreateCompany} style={{ display: "grid", gap: 8, maxWidth: 420 }}>
          <label style={{ display: "grid", gap: 4 }}>
            Legal name
            <input
              value={legalName}
              onChange={(event) => setLegalName(event.target.value)}
              placeholder="Minha Empresa Ltda"
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            CNPJ
            <input
              value={cnpj}
              onChange={(event) => setCnpj(event.target.value)}
              placeholder="00.000.000/0001-00"
            />
          </label>

          {createError ? <p style={{ color: "crimson" }}>{createError}</p> : null}

          <button type="submit" disabled={isCreatingCompany}>
            {isCreatingCompany ? "Criando..." : "Criar company"}
          </button>
        </form>

        {isLoadingData ? <p>Carregando companies...</p> : null}
        {loadError ? <p style={{ color: "crimson" }}>{loadError}</p> : null}

        {!isLoadingData && !loadError && companies.length === 0 ? (
          <p>Nenhuma company cadastrada.</p>
        ) : null}

        <ul style={{ display: "grid", gap: 6 }}>
          {companies.map((company) => (
            <li key={company.id}>
              {company.legal_name} - {company.cnpj}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
