"use client";

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useSession } from "../../../src/lib/auth/useSession";
import type { Database } from "../../../src/lib/supabase/db.types";
import { getSupabaseBrowser } from "../../../src/lib/supabase/browserClient";
import { useActiveTenant } from "../../../src/lib/tenancy/useActiveTenant";

type CompanyRow = Pick<Database["public"]["Tables"]["companies"]["Row"], "id" | "legal_name" | "cnpj">;
type NfseRow = Pick<
  Database["public"]["Tables"]["nfses"]["Row"],
  "id" | "status" | "provider_nfse_number" | "service_value" | "created_at"
>;
type NfseEventRow = Pick<
  Database["public"]["Tables"]["nfse_events"]["Row"],
  "id" | "event_type" | "payload" | "created_at" | "nfse_id"
>;

type IssueApiResponse = {
  nfseId: string;
  status: string;
  providerNfseNumber?: string;
  errorMessage?: string;
};

export function NfsesClient() {
  const router = useRouter();
  const { session, isLoading: isSessionLoading } = useSession();
  const { tenantId, isLoading: isTenantLoading, error: tenantError } = useActiveTenant();

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [companiesError, setCompaniesError] = useState("");

  const [nfses, setNfses] = useState<NfseRow[]>([]);
  const [isLoadingNfses, setIsLoadingNfses] = useState(true);
  const [nfsesError, setNfsesError] = useState("");

  const [eventsByNfse, setEventsByNfse] = useState<Record<string, NfseEventRow[]>>({});
  const [eventsErrorByNfse, setEventsErrorByNfse] = useState<Record<string, string>>({});
  const [loadingEventsByNfse, setLoadingEventsByNfse] = useState<Record<string, boolean>>({});
  const [expandedByNfse, setExpandedByNfse] = useState<Record<string, boolean>>({});

  const [companyId, setCompanyId] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceValueInput, setServiceValueInput] = useState("");
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [issueResult, setIssueResult] = useState<IssueApiResponse | null>(null);

  const parsedServiceValue = useMemo(() => Number(serviceValueInput), [serviceValueInput]);

  const loadCompanies = useCallback(async () => {
    if (!tenantId) return;

    setCompaniesError("");
    setIsLoadingCompanies(true);
    const supabase = getSupabaseBrowser();
    const { data, error } = await supabase
      .from("companies")
      .select("id, legal_name, cnpj")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      setCompaniesError("Não foi possível carregar as companies do tenant.");
      setIsLoadingCompanies(false);
      return;
    }

    const rows = data ?? [];
    setCompanies(rows);
    setIsLoadingCompanies(false);
    const firstCompany = rows[0];
    if (!companyId && firstCompany) {
      setCompanyId(firstCompany.id);
    }
  }, [companyId, tenantId]);

  const loadNfses = useCallback(async () => {
    if (!tenantId) return;

    setNfsesError("");
    setIsLoadingNfses(true);
    const supabase = getSupabaseBrowser();
    const { data, error } = await supabase
      .from("nfses")
      .select("id, status, provider_nfse_number, service_value, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      setNfsesError("Não foi possível carregar NFS-e.");
      setIsLoadingNfses(false);
      return;
    }

    setNfses(data ?? []);
    setIsLoadingNfses(false);
  }, [tenantId]);

  useEffect(() => {
    if (isSessionLoading) return;
    if (!session) router.replace("/auth/login");
  }, [isSessionLoading, router, session]);

  useEffect(() => {
    if (!tenantId) return;

    loadCompanies().catch(() => {
      setCompaniesError("Não foi possível carregar as companies do tenant.");
      setIsLoadingCompanies(false);
    });

    loadNfses().catch(() => {
      setNfsesError("Não foi possível carregar NFS-e.");
      setIsLoadingNfses(false);
    });
  }, [loadCompanies, loadNfses, tenantId]);

  const loadEvents = useCallback(
    async (nfseId: string) => {
      if (!tenantId) return;

      setEventsErrorByNfse((prev) => ({ ...prev, [nfseId]: "" }));
      setLoadingEventsByNfse((prev) => ({ ...prev, [nfseId]: true }));

      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from("nfse_events")
        .select("id, event_type, payload, created_at, nfse_id")
        .eq("tenant_id", tenantId)
        .eq("nfse_id", nfseId)
        .order("created_at", { ascending: false });

      setLoadingEventsByNfse((prev) => ({ ...prev, [nfseId]: false }));

      if (error) {
        setEventsErrorByNfse((prev) => ({ ...prev, [nfseId]: "Não foi possível carregar eventos." }));
        return;
      }

      setEventsByNfse((prev) => ({ ...prev, [nfseId]: data ?? [] }));
    },
    [tenantId]
  );

  async function handleIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIssueError("");
    setIssueResult(null);

    if (!session?.access_token) {
      setIssueError("Sessão inválida. Faça login novamente.");
      return;
    }
    if (!tenantId) {
      setIssueError("Tenant ativo não encontrado.");
      return;
    }
    if (!companyId) {
      setIssueError("Selecione uma company.");
      return;
    }
    if (!serviceDescription.trim()) {
      setIssueError("Descrição do serviço é obrigatória.");
      return;
    }
    if (!Number.isFinite(parsedServiceValue)) {
      setIssueError("Valor do serviço inválido.");
      return;
    }

    setIsIssuing(true);
    const idempotencyKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const response = await fetch("/api/nfse/issue", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenantId,
        companyId,
        idempotencyKey,
        serviceDescription: serviceDescription.trim(),
        serviceValue: parsedServiceValue,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | (IssueApiResponse & { error?: string })
      | null;
    setIsIssuing(false);

    if (!response.ok) {
      setIssueError(payload?.error ?? "Falha ao emitir NFS-e.");
      return;
    }

    setIssueResult({
      nfseId: payload?.nfseId ?? "",
      status: payload?.status ?? "submitted",
      providerNfseNumber: payload?.providerNfseNumber,
      errorMessage: payload?.errorMessage,
    });
    await loadNfses();
  }

  async function toggleEvents(nfseId: string) {
    const isExpanded = Boolean(expandedByNfse[nfseId]);
    setExpandedByNfse((prev) => ({ ...prev, [nfseId]: !isExpanded }));

    if (!isExpanded && !eventsByNfse[nfseId]) {
      await loadEvents(nfseId);
    }
  }

  if (isSessionLoading || isTenantLoading) {
    return (
      <main style={{ display: "grid", gap: 16 }}>
        <h1>NFS-e</h1>
        <p>Carregando...</p>
      </main>
    );
  }

  if (tenantError) {
    return (
      <main style={{ display: "grid", gap: 16 }}>
        <h1>NFS-e</h1>
        <p style={{ color: "crimson", margin: 0 }}>{tenantError}</p>
        <button type="button" onClick={() => router.refresh()}>
          Recarregar
        </button>
      </main>
    );
  }

  return (
    <main style={{ display: "grid", gap: 20 }}>
      <h1>NFS-e</h1>

      <section style={{ display: "grid", gap: 10, maxWidth: 560 }}>
        <h2>Emitir NFS-e (mock)</h2>
        <form onSubmit={handleIssue} style={{ display: "grid", gap: 8 }}>
          <label style={{ display: "grid", gap: 4 }}>
            Company
            <select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
              <option value="">Selecione...</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.legal_name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Descrição do serviço
            <textarea
              value={serviceDescription}
              onChange={(event) => setServiceDescription(event.target.value)}
              rows={4}
              placeholder="Serviço prestado..."
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Valor do serviço
            <input
              type="number"
              step="0.01"
              value={serviceValueInput}
              onChange={(event) => setServiceValueInput(event.target.value)}
              placeholder="0.00"
            />
          </label>

          {issueError ? <p style={{ color: "crimson", margin: 0 }}>{issueError}</p> : null}

          <button type="submit" disabled={isIssuing || !companyId}>
            {isIssuing ? "Emitindo..." : "Emitir (mock)"}
          </button>
        </form>

        {issueResult ? (
          <div style={{ display: "grid", gap: 4, border: "1px solid #ddd", padding: 10, borderRadius: 8 }}>
            <strong>Resultado da emissão</strong>
            <span>Status: {issueResult.status}</span>
            <span>NFS-e: {issueResult.providerNfseNumber || "-"}</span>
            <span>NFSe ID: {issueResult.nfseId}</span>
            {issueResult.errorMessage ? <span>Erro: {issueResult.errorMessage}</span> : null}
          </div>
        ) : null}
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <h2>Notas emitidas</h2>
        {isLoadingCompanies ? <p>Carregando companies...</p> : null}
        {companiesError ? <p style={{ color: "crimson" }}>{companiesError}</p> : null}

        {isLoadingNfses ? <p>Carregando NFS-es...</p> : null}
        {nfsesError ? <p style={{ color: "crimson" }}>{nfsesError}</p> : null}
        {!isLoadingNfses && !nfsesError && nfses.length === 0 ? <p>Nenhuma NFS-e encontrada.</p> : null}

        {!isLoadingNfses && !nfsesError && nfses.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>ID</th>
                <th style={{ textAlign: "left" }}>Status</th>
                <th style={{ textAlign: "left" }}>Número</th>
                <th style={{ textAlign: "left" }}>Valor</th>
                <th style={{ textAlign: "left" }}>Criada em</th>
                <th style={{ textAlign: "left" }}>Eventos</th>
              </tr>
            </thead>
            <tbody>
              {nfses.map((nfse) => (
                <Fragment key={nfse.id}>
                  <tr>
                    <td>{nfse.id.slice(0, 8)}...</td>
                    <td>{nfse.status}</td>
                    <td>{nfse.provider_nfse_number ?? "-"}</td>
                    <td>{nfse.service_value}</td>
                    <td>{new Date(nfse.created_at).toLocaleString()}</td>
                    <td>
                      <button type="button" onClick={() => toggleEvents(nfse.id)}>
                        {expandedByNfse[nfse.id] ? "Ocultar eventos" : "Ver eventos"}
                      </button>
                    </td>
                  </tr>
                  {expandedByNfse[nfse.id] ? (
                    <tr>
                      <td colSpan={6}>
                        {loadingEventsByNfse[nfse.id] ? <p>Carregando eventos...</p> : null}
                        {eventsErrorByNfse[nfse.id] ? (
                          <p style={{ color: "crimson" }}>{eventsErrorByNfse[nfse.id]}</p>
                        ) : null}
                        {!loadingEventsByNfse[nfse.id] && !eventsErrorByNfse[nfse.id] ? (
                          <ul style={{ margin: 0 }}>
                            {(eventsByNfse[nfse.id] ?? []).map((evt) => (
                              <li key={evt.id}>
                                <strong>{evt.event_type}</strong> - {new Date(evt.created_at).toLocaleString()}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </main>
  );
}
