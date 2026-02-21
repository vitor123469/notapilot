"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useSession } from "../../../../../src/lib/auth/useSession";
import type { Database } from "../../../../../src/lib/supabase/db.types";
import { getSupabaseBrowser } from "../../../../../src/lib/supabase/browserClient";
import { useActiveTenant } from "../../../../../src/lib/tenancy/useActiveTenant";

type CompanyRow = Pick<Database["public"]["Tables"]["companies"]["Row"], "id" | "legal_name" | "cnpj" | "municipal_registration">;
type FiscalSettingsRow = Database["public"]["Tables"]["company_fiscal_settings"]["Row"];

const TAX_REGIME_OPTIONS = [
  { value: "simples", label: "Simples Nacional" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
  { value: "mei", label: "MEI" },
  { value: "outro", label: "Outro" },
] as const;

function onlyDigits(input: string, max?: number): string {
  const normalized = input.replace(/\D/g, "");
  return typeof max === "number" ? normalized.slice(0, max) : normalized;
}

function formatServiceListItem(input: string): string {
  const digits = onlyDigits(input, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}.${digits.slice(2)}`;
}

export function CompanySettingsClient({ companyId }: { companyId: string }) {
  const router = useRouter();
  const { session, isLoading: isSessionLoading } = useSession();
  const { tenantId, isLoading: isTenantLoading, error: tenantError } = useActiveTenant();

  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [municipalRegistration, setMunicipalRegistration] = useState("");
  const [municipalityName, setMunicipalityName] = useState("");
  const [municipalityIbgeCode, setMunicipalityIbgeCode] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [addressDistrict, setAddressDistrict] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressZip, setAddressZip] = useState("");
  const [taxRegime, setTaxRegime] = useState("");
  const [cnae, setCnae] = useState("");
  const [serviceListItem, setServiceListItem] = useState("");
  const [serviceCode, setServiceCode] = useState("");
  const [issRate, setIssRate] = useState("");
  const [defaultServiceDescription, setDefaultServiceDescription] = useState("");

  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!tenantId) return;

    setLoadError("");
    setIsLoadingData(true);
    const supabase = getSupabaseBrowser();

    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .select("id, legal_name, cnpj, municipal_registration")
      .eq("id", companyId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (companyError) {
      setLoadError("Não foi possível carregar dados da empresa.");
      setIsLoadingData(false);
      return;
    }
    if (!companyData) {
      setLoadError("Empresa não encontrada para o tenant ativo.");
      setIsLoadingData(false);
      return;
    }

    setCompany(companyData);
    setMunicipalRegistration(companyData.municipal_registration ?? "");

    const { data: settingsData, error: settingsError } = await supabase
      .from("company_fiscal_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (settingsError) {
      setLoadError("Não foi possível carregar configurações fiscais.");
      setIsLoadingData(false);
      return;
    }

    const settings = settingsData as FiscalSettingsRow | null;
    setMunicipalityName(settings?.municipality_name ?? "");
    setMunicipalityIbgeCode(settings?.municipality_ibge_code ?? "");
    setStateUf(settings?.state_uf ?? "");
    setAddressStreet(settings?.address_street ?? "");
    setAddressNumber(settings?.address_number ?? "");
    setAddressComplement(settings?.address_complement ?? "");
    setAddressDistrict(settings?.address_district ?? "");
    setAddressCity(settings?.address_city ?? "");
    setAddressZip(settings?.address_zip ?? "");
    setTaxRegime(settings?.tax_regime ?? "");
    setCnae(settings?.cnae ?? "");
    setServiceListItem(settings?.service_list_item ?? "");
    setServiceCode(settings?.service_code ?? "");
    setIssRate(settings?.iss_rate != null ? String(settings.iss_rate) : "");
    setDefaultServiceDescription(settings?.default_service_description ?? "");
    setIsLoadingData(false);
  }, [companyId, tenantId]);

  useEffect(() => {
    if (isSessionLoading) return;
    if (!session) {
      router.replace("/auth/login");
    }
  }, [isSessionLoading, router, session]);

  useEffect(() => {
    if (!tenantId) return;

    loadData().catch(() => {
      setLoadError("Não foi possível carregar dados da configuração fiscal.");
      setIsLoadingData(false);
    });
  }, [loadData, tenantId]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantId || !company) {
      setSaveError("Tenant ou empresa inválidos.");
      return;
    }

    setSaveError("");
    setSaveMessage("");
    setIsSaving(true);
    const supabase = getSupabaseBrowser();

    const normalizedUf = stateUf.trim().toUpperCase().slice(0, 2);
    const normalizedZip = onlyDigits(addressZip, 8);
    const normalizedCnae = onlyDigits(cnae);
    const normalizedIbge = onlyDigits(municipalityIbgeCode);
    const normalizedServiceListItem = formatServiceListItem(serviceListItem);
    const parsedIssRate = issRate.trim() ? Number(issRate) : null;

    if (parsedIssRate != null && (!Number.isFinite(parsedIssRate) || parsedIssRate < 0 || parsedIssRate > 100)) {
      setSaveError("Alíquota ISS deve estar entre 0 e 100.");
      setIsSaving(false);
      return;
    }

    const { error: upsertError } = await supabase.from("company_fiscal_settings").upsert(
      {
        tenant_id: tenantId,
        company_id: company.id,
        municipality_name: municipalityName.trim() || null,
        municipality_ibge_code: normalizedIbge || null,
        state_uf: normalizedUf || null,
        address_street: addressStreet.trim() || null,
        address_number: addressNumber.trim() || null,
        address_complement: addressComplement.trim() || null,
        address_district: addressDistrict.trim() || null,
        address_city: addressCity.trim() || null,
        address_zip: normalizedZip || null,
        tax_regime: taxRegime || null,
        cnae: normalizedCnae || null,
        service_list_item: normalizedServiceListItem || null,
        service_code: serviceCode.trim() || null,
        iss_rate: parsedIssRate,
        default_service_description: defaultServiceDescription.trim() || null,
      },
      { onConflict: "tenant_id,company_id" }
    );

    if (upsertError) {
      setSaveError("Falha ao salvar configurações fiscais.");
      setIsSaving(false);
      return;
    }

    if ((municipalRegistration.trim() || null) !== (company.municipal_registration ?? null)) {
      const { error: companyUpdateError } = await supabase
        .from("companies")
        .update({ municipal_registration: municipalRegistration.trim() || null })
        .eq("tenant_id", tenantId)
        .eq("id", company.id);

      if (companyUpdateError) {
        setSaveError("Config fiscal salva, mas falhou ao atualizar inscrição municipal da empresa.");
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(false);
    setSaveMessage("Salvo.");
    setTimeout(() => {
      router.push("/app/companies");
    }, 500);
  }

  const checklist = useMemo(() => {
    return [
      { label: "CNPJ da empresa", ok: Boolean(company?.cnpj) },
      { label: "Inscrição municipal (IM)", ok: Boolean(municipalRegistration.trim()) },
      { label: "Município e UF", ok: Boolean(municipalityName.trim() && stateUf.trim().length === 2) },
      { label: "Endereço (CEP, rua e número)", ok: Boolean(addressZip.trim() && addressStreet.trim() && addressNumber.trim()) },
      { label: "Regime tributário", ok: Boolean(taxRegime) },
      { label: "Item da lista de serviços (LC116)", ok: Boolean(serviceListItem.trim()) },
      { label: "Alíquota ISS", ok: issRate.trim().length > 0 && Number(issRate) >= 0 && Number(issRate) <= 100 },
    ];
  }, [
    addressNumber,
    addressStreet,
    addressZip,
    company?.cnpj,
    issRate,
    municipalRegistration,
    municipalityName,
    serviceListItem,
    stateUf,
    taxRegime,
  ]);

  const pendingCount = checklist.filter((item) => !item.ok).length;
  const isReady = pendingCount === 0;

  if (isSessionLoading || isTenantLoading) {
    return <p>Carregando...</p>;
  }

  if (tenantError) {
    return (
      <main style={{ display: "grid", gap: 12 }}>
        <h1>Config Fiscal</h1>
        <p style={{ color: "crimson", margin: 0 }}>{tenantError}</p>
        <button type="button" onClick={() => router.refresh()}>
          Recarregar
        </button>
      </main>
    );
  }

  return (
    <main style={{ display: "grid", gap: 20 }}>
      <header style={{ display: "grid", gap: 4 }}>
        <h1>Config Fiscal</h1>
        <button type="button" onClick={() => router.push("/app/companies")} style={{ width: "fit-content" }}>
          Voltar
        </button>
        {company ? <p style={{ margin: 0 }}>Empresa: {company.legal_name}</p> : null}
        <span
          style={{
            display: "inline-block",
            width: "fit-content",
            padding: "2px 8px",
            borderRadius: 999,
            border: "1px solid #999",
            fontWeight: 600,
          }}
        >
          {isReady ? "Pronto" : `Pendências: ${pendingCount}`}
        </span>
      </header>

      {isLoadingData ? <p>Carregando configuração fiscal...</p> : null}
      {loadError ? <p style={{ color: "crimson", margin: 0 }}>{loadError}</p> : null}

      {!isLoadingData && !loadError ? (
        <div
          style={{
            border: "1px solid #ddd",
            padding: 16,
            borderRadius: 12,
            maxWidth: 900,
            display: "grid",
            gap: 16,
          }}
        >
          <section style={{ display: "grid", gap: 8 }}>
            <h2>Pronto pra emitir (real)</h2>
            <ul style={{ margin: 0 }}>
              {checklist.map((item) => (
                <li key={item.label}>
                  {item.ok ? "OK" : "Faltando"} - {item.label}
                </li>
              ))}
            </ul>
          </section>

          <section style={{ display: "grid", gap: 8, maxWidth: 680 }}>
            <h2>Dados fiscais da empresa</h2>
            <form onSubmit={handleSave} style={{ display: "grid", gap: 8 }}>
              <label style={{ display: "grid", gap: 4 }}>
                Inscrição Municipal
                <input
                  value={municipalRegistration}
                  onChange={(event) => setMunicipalRegistration(event.target.value)}
                  placeholder="IM"
                />
              </label>

              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 120px 160px" }}>
                <label style={{ display: "grid", gap: 4 }}>
                  Município
                  <input
                    value={municipalityName}
                    onChange={(event) => setMunicipalityName(event.target.value)}
                    placeholder="São Paulo"
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  UF
                  <input
                    value={stateUf}
                    onChange={(event) => setStateUf(event.target.value.toUpperCase())}
                    placeholder="SP"
                    maxLength={2}
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  Código IBGE
                  <input
                    value={municipalityIbgeCode}
                    onChange={(event) => setMunicipalityIbgeCode(onlyDigits(event.target.value))}
                    placeholder="3550308"
                  />
                </label>
              </div>

              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 120px" }}>
                <label style={{ display: "grid", gap: 4 }}>
                  Rua
                  <input
                    value={addressStreet}
                    onChange={(event) => setAddressStreet(event.target.value)}
                    placeholder="Rua Exemplo"
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  Número
                  <input
                    value={addressNumber}
                    onChange={(event) => setAddressNumber(event.target.value)}
                    placeholder="123"
                  />
                </label>
              </div>

              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 160px" }}>
                <label style={{ display: "grid", gap: 4 }}>
                  Bairro
                  <input
                    value={addressDistrict}
                    onChange={(event) => setAddressDistrict(event.target.value)}
                    placeholder="Centro"
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  Cidade
                  <input value={addressCity} onChange={(event) => setAddressCity(event.target.value)} placeholder="São Paulo" />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  CEP
                  <input
                    value={addressZip}
                    onChange={(event) => setAddressZip(onlyDigits(event.target.value, 8))}
                    placeholder="00000000"
                  />
                </label>
              </div>

              <label style={{ display: "grid", gap: 4 }}>
                Complemento
                <input
                  value={addressComplement}
                  onChange={(event) => setAddressComplement(event.target.value)}
                  placeholder="Sala, bloco..."
                />
              </label>

              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr" }}>
                <label style={{ display: "grid", gap: 4 }}>
                  Regime tributário
                  <select value={taxRegime} onChange={(event) => setTaxRegime(event.target.value)}>
                    <option value="">Selecione...</option>
                    {TAX_REGIME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  CNAE
                  <input value={cnae} onChange={(event) => setCnae(onlyDigits(event.target.value))} placeholder="0000000" />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  Alíquota ISS (%)
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    value={issRate}
                    onChange={(event) => setIssRate(event.target.value)}
                    placeholder="5.00"
                  />
                </label>
              </div>

              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                <label style={{ display: "grid", gap: 4 }}>
                  Item lista de serviços (LC116)
                  <input
                    value={serviceListItem}
                    onChange={(event) => setServiceListItem(formatServiceListItem(event.target.value))}
                    placeholder="01.07"
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  Código do serviço municipal
                  <input
                    value={serviceCode}
                    onChange={(event) => setServiceCode(event.target.value)}
                    placeholder="Cód. municipal"
                  />
                </label>
              </div>

              <label style={{ display: "grid", gap: 4 }}>
                Descrição padrão do serviço
                <textarea
                  value={defaultServiceDescription}
                  onChange={(event) => setDefaultServiceDescription(event.target.value)}
                  rows={4}
                  placeholder="Descrição padrão para emissão"
                />
              </label>

              {saveError ? <p style={{ color: "crimson", margin: 0 }}>{saveError}</p> : null}
              {saveMessage ? <p style={{ color: "green", margin: 0 }}>{saveMessage}</p> : null}

              <button type="submit" disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar"}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
