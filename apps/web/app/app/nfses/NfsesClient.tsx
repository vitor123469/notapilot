"use client";

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useSession } from "../../../src/lib/auth/useSession";
import { translateIssueError } from "../../../src/lib/fiscal/errorTranslator";
import type { Translation } from "../../../src/lib/fiscal/errorTranslator.types";
import type { Database } from "../../../src/lib/supabase/db.types";
import { getSupabaseBrowser } from "../../../src/lib/supabase/browserClient";
import { useActiveTenant } from "../../../src/lib/tenancy/useActiveTenant";

type CompanyRow = Pick<Database["public"]["Tables"]["companies"]["Row"], "id" | "legal_name" | "cnpj">;
type NfseRow = Pick<
  Database["public"]["Tables"]["nfses"]["Row"],
  "id" | "status" | "provider_nfse_number" | "service_value" | "created_at" | "company_id" | "error_code" | "error_message"
>;
type NfseEventRow = Pick<
  Database["public"]["Tables"]["nfse_events"]["Row"],
  "id" | "event_type" | "payload" | "created_at" | "nfse_id"
>;

type IssueApiResponse = {
  nfseId: string;
  status: string;
  providerNfseNumber?: string;
  errorCode?: string;
  errorMessage?: string;
};

type ValidationItem = {
  field: string;
  label: string;
};

type ValidationFailedResponse = {
  error: "VALIDATION_FAILED";
  missing?: ValidationItem[];
  warnings?: ValidationItem[];
};

type DryRunResponse = {
  ok: boolean;
  missing?: ValidationItem[];
  warnings?: ValidationItem[];
};

function getResponseMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const maybeMessage = (payload as { message?: unknown }).message;
  return typeof maybeMessage === "string" ? maybeMessage : undefined;
}

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
  const [issueTranslation, setIssueTranslation] = useState<Translation | null>(null);
  const [issueResult, setIssueResult] = useState<IssueApiResponse | null>(null);
  const [translatedByNfse, setTranslatedByNfse] = useState<Record<string, Translation | null>>({});
  const [showTranslatedByNfse, setShowTranslatedByNfse] = useState<Record<string, boolean>>({});

  const parsedServiceValue = useMemo(() => Number(serviceValueInput), [serviceValueInput]);

  const createIdempotencyKey = useCallback(() => {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }, []);

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
      .select("id, status, provider_nfse_number, service_value, created_at, company_id, error_code, error_message")
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
    setIssueTranslation(null);
    setIssueResult(null);

    if (!session?.access_token) {
      setIssueTranslation(
        translateIssueError({
          type: "UNKNOWN",
          companyId,
          errorMessage: "Sessão inválida. Faça login novamente.",
        })
      );
      return;
    }
    if (!tenantId) {
      setIssueTranslation(
        translateIssueError({
          type: "UNKNOWN",
          companyId,
          errorMessage: "Tenant ativo não encontrado.",
        })
      );
      return;
    }
    if (!companyId) {
      setIssueTranslation(
        translateIssueError({
          type: "UNKNOWN",
          errorMessage: "Selecione uma empresa para emitir.",
        })
      );
      return;
    }
    if (!Number.isFinite(parsedServiceValue)) {
      setIssueTranslation(
        translateIssueError({
          type: "PROVIDER_REJECTED",
          companyId,
          errorCode: "E_VALUE",
          errorMessage: "Valor do serviço inválido.",
        })
      );
      return;
    }

    setIsIssuing(true);
    const dryRunResponse = await fetch("/api/nfse/issue", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenantId,
        companyId,
        idempotencyKey: createIdempotencyKey(),
        dryRun: true,
        serviceDescription: serviceDescription.trim(),
        serviceValue: parsedServiceValue,
      }),
    });

    const dryRunPayload = (await dryRunResponse.json().catch(() => null)) as
      | (DryRunResponse & { error?: string; message?: string })
      | ValidationFailedResponse
      | null;

    if (dryRunResponse.status === 422 && dryRunPayload?.error === "VALIDATION_FAILED") {
      setIssueTranslation(
        translateIssueError({
          type: "VALIDATION_FAILED",
          companyId,
          missing: (dryRunPayload as ValidationFailedResponse).missing ?? [],
          warnings: (dryRunPayload as ValidationFailedResponse).warnings ?? [],
        })
      );
      setIsIssuing(false);
      return;
    }

    if (!dryRunResponse.ok) {
      setIssueTranslation(
        translateIssueError({
          type: "UNKNOWN",
          companyId,
          errorMessage: getResponseMessage(dryRunPayload) ?? "Falha ao validar dados para emissão.",
        })
      );
      setIsIssuing(false);
      return;
    }

    const response = await fetch("/api/nfse/issue", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenantId,
        companyId,
        idempotencyKey: createIdempotencyKey(),
        serviceDescription: serviceDescription.trim(),
        serviceValue: parsedServiceValue,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | (IssueApiResponse & { error?: string; message?: string })
      | ValidationFailedResponse
      | null;
    setIsIssuing(false);

    if (!response.ok) {
      if (response.status === 422 && payload?.error === "VALIDATION_FAILED") {
        setIssueTranslation(
          translateIssueError({
            type: "VALIDATION_FAILED",
            companyId,
            missing: (payload as ValidationFailedResponse).missing ?? [],
            warnings: (payload as ValidationFailedResponse).warnings ?? [],
          })
        );
        return;
      }
      setIssueTranslation(
        translateIssueError({
          type: "UNKNOWN",
          companyId,
          errorMessage: getResponseMessage(payload) ?? "Falha ao emitir NFS-e.",
        })
      );
      return;
    }

    const issuePayload = payload as IssueApiResponse | null;
    if (issuePayload?.status === "rejected") {
      setIssueTranslation(
        translateIssueError({
          type: "PROVIDER_REJECTED",
          companyId,
          errorCode: issuePayload.errorCode,
          errorMessage: issuePayload.errorMessage,
        })
      );
    } else {
      setIssueTranslation(null);
    }
    setIssueResult({
      nfseId: issuePayload?.nfseId ?? "",
      status: issuePayload?.status ?? "submitted",
      providerNfseNumber: issuePayload?.providerNfseNumber,
      errorCode: issuePayload?.errorCode,
      errorMessage: issuePayload?.errorMessage,
    });
    await loadNfses();
  }

  function handleTranslationAction(actionLabel: string) {
    if (actionLabel === "Voltar") {
      router.back();
      return;
    }
    if (actionLabel === "Tentar novamente") {
      setIssueTranslation(null);
      return;
    }
  }

  function handleExplainRejected(nfse: NfseRow) {
    const isVisible = Boolean(showTranslatedByNfse[nfse.id]);
    setShowTranslatedByNfse((prev) => ({ ...prev, [nfse.id]: !isVisible }));
    if (isVisible || translatedByNfse[nfse.id]) {
      return;
    }

    const translation = translateIssueError({
      type: "PROVIDER_REJECTED",
      companyId: nfse.company_id,
      errorCode: nfse.error_code,
      errorMessage: nfse.error_message,
    });
    setTranslatedByNfse((prev) => ({ ...prev, [nfse.id]: translation }));
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

          {issueTranslation ? (
            <div
              style={{
                display: "grid",
                gap: 8,
                border: `1px solid ${issueTranslation.severity === "error" ? "#f0b3b3" : "#f0d4d4"}`,
                padding: 10,
                borderRadius: 8,
                background: issueTranslation.severity === "info" ? "#f7fbff" : "#fff",
              }}
            >
              <strong>{issueTranslation.title}</strong>
              <span>{issueTranslation.message}</span>
              {issueTranslation.fields && issueTranslation.fields.length > 0 ? (
                <ul style={{ margin: 0 }}>
                  {issueTranslation.fields.map((field) => (
                    <li key={`${field.field}-${field.label}`}>
                      {field.label}
                      {field.suggestion ? ` - ${field.suggestion}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {issueTranslation.actions.map((action) =>
                  action.href ? (
                    <Link
                      key={`${action.label}-${action.href}`}
                      href={action.href}
                      style={{ border: "1px solid #999", borderRadius: 8, padding: "4px 10px", textDecoration: "none" }}
                    >
                      {action.label}
                    </Link>
                  ) : (
                    <button key={action.label} type="button" onClick={() => handleTranslationAction(action.label)}>
                      {action.label}
                    </button>
                  )
                )}
              </div>
            </div>
          ) : null}

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
            <span>Código: {issueResult.errorCode || "-"}</span>
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
                <th style={{ textAlign: "left" }}>Ações</th>
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
                    <td style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => toggleEvents(nfse.id)}>
                        {expandedByNfse[nfse.id] ? "Ocultar eventos" : "Ver eventos"}
                      </button>
                      {nfse.status === "rejected" ? (
                        <button type="button" onClick={() => handleExplainRejected(nfse)}>
                          {showTranslatedByNfse[nfse.id] ? "Ocultar explicação" : "Entender erro"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  {showTranslatedByNfse[nfse.id] && translatedByNfse[nfse.id] ? (
                    <tr>
                      <td colSpan={6}>
                        <div style={{ display: "grid", gap: 6, border: "1px solid #f0d4d4", borderRadius: 8, padding: 10 }}>
                          <strong>{translatedByNfse[nfse.id]?.title}</strong>
                          <span>{translatedByNfse[nfse.id]?.message}</span>
                          {(translatedByNfse[nfse.id]?.fields ?? []).length > 0 ? (
                            <ul style={{ margin: 0 }}>
                              {(translatedByNfse[nfse.id]?.fields ?? []).map((field) => (
                                <li key={`${nfse.id}-${field.field}`}>
                                  {field.label}
                                  {field.suggestion ? ` - ${field.suggestion}` : ""}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
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
