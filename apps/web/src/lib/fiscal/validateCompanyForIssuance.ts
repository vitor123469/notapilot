import type { Database } from "../supabase/db.types";
import { getSupabaseAdmin } from "../supabase/admin";

type CompanyRow = Pick<Database["public"]["Tables"]["companies"]["Row"], "id" | "cnpj" | "municipal_registration">;
type CompanyFiscalSettingsRow = Database["public"]["Tables"]["company_fiscal_settings"]["Row"];

export type IssuanceValidationItem = {
  field: string;
  label: string;
  suggestion?: string;
};

export type ValidateCompanyForIssuanceInput = {
  tenantId: string;
  companyId: string;
  serviceDescription?: string;
  serviceValue?: number;
};

export type ValidateCompanyForIssuanceResult = {
  ok: boolean;
  missing: IssuanceValidationItem[];
  warnings: IssuanceValidationItem[];
  snapshot: {
    company: {
      id: string;
      cnpj: string;
      municipalRegistration: string | null;
    } | null;
    settings: {
      municipalityName: string | null;
      stateUf: string | null;
      addressZip: string | null;
      addressStreet: string | null;
      addressNumber: string | null;
      taxRegime: string | null;
      serviceListItem: string | null;
      issRate: number | null;
      defaultServiceDescription: string | null;
      municipalityIbgeCode: string | null;
      cnae: string | null;
      serviceCode: string | null;
    } | null;
    providedServiceDescription: string;
    effectiveServiceDescription: string;
    serviceValue: number | null;
  };
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function missingWhenEmpty(
  collection: IssuanceValidationItem[],
  value: string | null | undefined,
  field: string,
  label: string
) {
  if (!hasText(value)) {
    collection.push({ field, label });
  }
}

function warningWhenEmpty(
  collection: IssuanceValidationItem[],
  value: string | null | undefined,
  field: string,
  label: string
) {
  if (!hasText(value)) {
    collection.push({ field, label });
  }
}

export async function validateCompanyForIssuance(
  input: ValidateCompanyForIssuanceInput
): Promise<ValidateCompanyForIssuanceResult> {
  const admin = getSupabaseAdmin();
  const tenantId = input.tenantId.trim();
  const companyId = input.companyId.trim();
  const providedServiceDescription = input.serviceDescription?.trim() ?? "";
  const normalizedServiceValue = Number.isFinite(input.serviceValue) ? Number(input.serviceValue) : null;

  const { data: company, error: companyError } = await admin
    .from("companies")
    .select("id, cnpj, municipal_registration")
    .eq("tenant_id", tenantId)
    .eq("id", companyId)
    .maybeSingle<CompanyRow>();

  if (companyError) {
    throw new Error(companyError.message);
  }

  const { data: settings, error: settingsError } = await admin
    .from("company_fiscal_settings")
    .select(
      "municipality_name, state_uf, address_zip, address_street, address_number, tax_regime, service_list_item, iss_rate, default_service_description, municipality_ibge_code, cnae, service_code"
    )
    .eq("tenant_id", tenantId)
    .eq("company_id", companyId)
    .maybeSingle<CompanyFiscalSettingsRow>();

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  const missing: IssuanceValidationItem[] = [];
  const warnings: IssuanceValidationItem[] = [];

  if (!company) {
    missing.push({ field: "company", label: "Empresa inválida ou não encontrada." });
  } else {
    missingWhenEmpty(
      missing,
      company.municipal_registration,
      "companies.municipal_registration",
      "Inscrição municipal da empresa (IM)"
    );
  }

  if (!settings) {
    missing.push({ field: "settings", label: "Configurações fiscais da empresa" });
  } else {
    missingWhenEmpty(missing, settings.municipality_name, "settings.municipality_name", "Município");
    missingWhenEmpty(missing, settings.state_uf, "settings.state_uf", "UF");
    missingWhenEmpty(missing, settings.address_zip, "settings.address_zip", "CEP");
    missingWhenEmpty(missing, settings.address_street, "settings.address_street", "Logradouro");
    missingWhenEmpty(missing, settings.address_number, "settings.address_number", "Número");
    missingWhenEmpty(missing, settings.tax_regime, "settings.tax_regime", "Regime tributário");
    missingWhenEmpty(missing, settings.service_list_item, "settings.service_list_item", "Item da lista de serviço");

    if (settings.iss_rate === null || settings.iss_rate === undefined) {
      missing.push({ field: "settings.iss_rate", label: "Alíquota de ISS" });
    }

    warningWhenEmpty(
      warnings,
      settings.municipality_ibge_code,
      "settings.municipality_ibge_code",
      "Código IBGE do município"
    );
    warningWhenEmpty(warnings, settings.cnae, "settings.cnae", "CNAE");
    warningWhenEmpty(warnings, settings.service_code, "settings.service_code", "Código de serviço");
  }

  const defaultServiceDescription = settings?.default_service_description?.trim() ?? "";
  const effectiveServiceDescription = providedServiceDescription || defaultServiceDescription;
  if (!effectiveServiceDescription) {
    missing.push({
      field: "serviceDescription",
      label: "Descrição do serviço",
      suggestion: "Preencha a descrição no formulário (ou defina uma descrição padrão na Config fiscal).",
    });
  }

  if (normalizedServiceValue === null || normalizedServiceValue <= 0) {
    missing.push({
      field: "serviceValue",
      label: "Valor do serviço",
      suggestion: "Informe um valor maior que zero no formulário de emissão.",
    });
  }

  return {
    ok: missing.length === 0,
    missing,
    warnings,
    snapshot: {
      company: company
        ? {
            id: company.id,
            cnpj: company.cnpj,
            municipalRegistration: company.municipal_registration,
          }
        : null,
      settings: settings
        ? {
            municipalityName: settings.municipality_name,
            stateUf: settings.state_uf,
            addressZip: settings.address_zip,
            addressStreet: settings.address_street,
            addressNumber: settings.address_number,
            taxRegime: settings.tax_regime,
            serviceListItem: settings.service_list_item,
            issRate: settings.iss_rate,
            defaultServiceDescription: settings.default_service_description,
            municipalityIbgeCode: settings.municipality_ibge_code,
            cnae: settings.cnae,
            serviceCode: settings.service_code,
          }
        : null,
      providedServiceDescription,
      effectiveServiceDescription,
      serviceValue: normalizedServiceValue,
    },
  };
}
