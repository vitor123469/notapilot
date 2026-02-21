"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { formatCnpj, isValidCnpj, normalizeCnpj } from "../../../src/lib/br/cnpj";
import type { Database } from "../../../src/lib/supabase/db.types";
import { getSupabaseBrowser } from "../../../src/lib/supabase/browserClient";
import { useActiveTenant } from "../../../src/lib/tenancy/useActiveTenant";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type CompanyListRow = Pick<
  CompanyRow,
  "id" | "legal_name" | "trade_name" | "cnpj" | "municipal_registration" | "created_at"
>;

function getFriendlyCompanyError(error: { code?: string; message: string; details?: string | null }): string {
  const text = `${error.message} ${error.details ?? ""}`.toLowerCase();
  if (error.code === "23505" && text.includes("cnpj")) {
    return "Já existe uma empresa com este CNPJ para o tenant ativo.";
  }
  return error.message;
}

export function CompaniesClient() {
  const router = useRouter();
  const { tenantId, isLoading: isTenantLoading, error: tenantError } = useActiveTenant();

  const [companies, setCompanies] = useState<CompanyListRow[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);

  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [municipalRegistration, setMunicipalRegistration] = useState("");

  const cnpjDigits = useMemo(() => normalizeCnpj(cnpj), [cnpj]);
  const cnpjError =
    cnpjDigits.length > 0 && cnpjDigits.length < 14
      ? "CNPJ incompleto"
      : cnpjDigits.length === 14 && !isValidCnpj(cnpjDigits)
        ? "CNPJ inválido"
        : "";
  const isFormInvalid = !legalName.trim() || !cnpjDigits || Boolean(cnpjError);

  const resetForm = useCallback(() => {
    setLegalName("");
    setTradeName("");
    setCnpj("");
    setMunicipalRegistration("");
    setEditingCompanyId(null);
    setSubmitError("");
  }, []);

  const loadCompanies = useCallback(async () => {
    if (!tenantId) return;

    const supabase = getSupabaseBrowser();
    setLoadError("");
    setIsLoadingData(true);

    const { data, error } = await supabase
      .from("companies")
      .select("id, legal_name, trade_name, cnpj, municipal_registration, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      setLoadError("Não foi possível carregar companies. Tente recarregar.");
      setIsLoadingData(false);
      return;
    }

    setCompanies(data ?? []);
    setIsLoadingData(false);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;

    loadCompanies().catch(() => {
      setLoadError("Não foi possível carregar companies. Tente recarregar.");
      setIsLoadingData(false);
    });
  }, [loadCompanies, tenantId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");

    if (!tenantId) {
      setSubmitError("Tenant ativo não encontrado.");
      return;
    }

    if (isFormInvalid) {
      setSubmitError(cnpjError || "Preencha os campos obrigatórios.");
      return;
    }

    const payload = {
      legal_name: legalName.trim(),
      trade_name: tradeName.trim() || null,
      cnpj: cnpjDigits,
      municipal_registration: municipalRegistration.trim() || null,
    };

    setIsSubmitting(true);
    const supabase = getSupabaseBrowser();

    const result = editingCompanyId
      ? await supabase.from("companies").update(payload).eq("id", editingCompanyId).eq("tenant_id", tenantId)
      : await supabase.from("companies").insert({ ...payload, tenant_id: tenantId });

    setIsSubmitting(false);

    if (result.error) {
      setSubmitError(getFriendlyCompanyError(result.error));
      return;
    }

    resetForm();
    await loadCompanies();
  }

  function handleEdit(company: CompanyListRow) {
    setSubmitError("");
    setDeleteError("");
    setEditingCompanyId(company.id);
    setLegalName(company.legal_name);
    setTradeName(company.trade_name ?? "");
    setCnpj(formatCnpj(company.cnpj));
    setMunicipalRegistration(company.municipal_registration ?? "");
  }

  async function handleDelete(company: CompanyListRow) {
    if (!tenantId) {
      setDeleteError("Tenant ativo não encontrado.");
      return;
    }

    const confirmed = window.confirm(`Tem certeza que deseja excluir "${company.legal_name}"?`);
    if (!confirmed) return;

    setDeleteError("");
    setDeletingCompanyId(company.id);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.from("companies").delete().eq("id", company.id).eq("tenant_id", tenantId);
    setDeletingCompanyId(null);

    if (error) {
      setDeleteError("Não foi possível excluir company. Tente recarregar.");
      return;
    }

    if (editingCompanyId === company.id) {
      resetForm();
    }

    await loadCompanies();
  }

  if (isTenantLoading) {
    return (
      <main style={{ display: "grid", gap: 20 }}>
        <h1>Empresas</h1>
        <p>Validando tenant ativo...</p>
      </main>
    );
  }

  if (tenantError) {
    return (
      <main style={{ display: "grid", gap: 20 }}>
        <h1>Empresas</h1>
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
        <h1>Empresas</h1>
        <p>Preparando tenant...</p>
      </main>
    );
  }

  return (
    <main style={{ display: "grid", gap: 20 }}>
      <h1>Empresas</h1>

      <section style={{ display: "grid", gap: 10, maxWidth: 520 }}>
        <h2>{editingCompanyId ? "Editar empresa" : "Criar company"}</h2>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8 }}>
          <label style={{ display: "grid", gap: 4 }}>
            Razão social *
            <input
              value={legalName}
              onChange={(event) => setLegalName(event.target.value)}
              placeholder="Minha Empresa Ltda"
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Nome fantasia
            <input value={tradeName} onChange={(event) => setTradeName(event.target.value)} placeholder="Minha Marca" />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            CNPJ *
            <input
              value={cnpj}
              onChange={(event) => {
                const digits = normalizeCnpj(event.target.value);
                setCnpj(formatCnpj(digits));
              }}
              placeholder="00.000.000/0001-00"
            />
          </label>
          {cnpjError ? <p style={{ color: "crimson", margin: 0 }}>{cnpjError}</p> : null}

          <label style={{ display: "grid", gap: 4 }}>
            Inscrição municipal
            <input
              value={municipalRegistration}
              onChange={(event) => setMunicipalRegistration(event.target.value)}
              placeholder="123456"
            />
          </label>

          {submitError ? <p style={{ color: "crimson", margin: 0 }}>{submitError}</p> : null}

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={isSubmitting || isFormInvalid}>
              {isSubmitting
                ? editingCompanyId
                  ? "Salvando..."
                  : "Criando..."
                : editingCompanyId
                  ? "Salvar alterações"
                  : "Criar company"}
            </button>

            {editingCompanyId ? (
              <button type="button" onClick={resetForm} disabled={isSubmitting}>
                Cancelar edição
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <h2>Lista de companies</h2>
        {isLoadingData ? <p>Carregando companies...</p> : null}
        {loadError ? (
          <div style={{ display: "grid", gap: 8 }}>
            <p style={{ color: "crimson", margin: 0 }}>{loadError}</p>
            <button type="button" onClick={() => loadCompanies()}>
              Recarregar
            </button>
          </div>
        ) : null}
        {deleteError ? <p style={{ color: "crimson" }}>{deleteError}</p> : null}

        {!isLoadingData && !loadError && companies.length === 0 ? <p>Nenhuma company cadastrada.</p> : null}

        {!isLoadingData && !loadError && companies.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Nome</th>
                <th style={{ textAlign: "left" }}>Fantasia</th>
                <th style={{ textAlign: "left" }}>CNPJ</th>
                <th style={{ textAlign: "left" }}>Inscrição Municipal</th>
                <th style={{ textAlign: "left" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id}>
                  <td>{company.legal_name}</td>
                  <td>{company.trade_name || "-"}</td>
                  <td>{formatCnpj(company.cnpj)}</td>
                  <td>{company.municipal_registration || "-"}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => handleEdit(company)} disabled={isSubmitting}>
                      Editar
                    </button>
                    <Link href={`/app/companies/${company.id}/settings`}>Config fiscal</Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(company)}
                      disabled={Boolean(deletingCompanyId) || isSubmitting}
                    >
                      {deletingCompanyId === company.id ? "Excluindo..." : "Excluir"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </main>
  );
}
