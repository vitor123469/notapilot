import type { Translation, TranslationField } from "./errorTranslator.types";

type ValidationItem = {
  field: string;
  label: string;
  suggestion?: string;
};

type TranslateIssueErrorInput =
  | {
      type: "VALIDATION_FAILED";
      companyId?: string;
      missing?: ValidationItem[];
      warnings?: ValidationItem[];
    }
  | {
      type: "PROVIDER_REJECTED";
      companyId?: string;
      errorCode?: string | null;
      errorMessage?: string | null;
    }
  | {
      type: "UNKNOWN";
      companyId?: string;
      errorMessage?: string | null;
    };

function normalizeMessage(input: string | null | undefined): string {
  if (!input) return "Não foi possível concluir a emissão no momento.";
  return input.replace(/\s+/g, " ").replace(/(postgrest|sqlstate|stack|traceback)\b/gi, "").trim();
}

const FORM_FIELDS = new Set(["serviceValue", "serviceDescription"]);

function isFormField(field: string): boolean {
  return FORM_FIELDS.has(field);
}

function toField(item: ValidationItem, isWarning: boolean): TranslationField {
  return {
    field: item.field,
    label: item.label,
    suggestion:
      item.suggestion ??
      (isFormField(item.field)
        ? "Preencha esse dado no formulário de emissão."
        : isWarning
          ? "Recomendado ajustar na Config fiscal."
          : "Complete esse dado na Config fiscal."),
  };
}

function configActions(companyId?: string): Translation["actions"] {
  return [
    {
      label: "Abrir Config fiscal",
      href: companyId ? `/app/companies/${companyId}/settings?returnTo=%2Fapp%2Fnfses` : "/app/companies",
      kind: "link",
    },
    { label: "Voltar", kind: "button" },
  ];
}

export function translateIssueError(input: TranslateIssueErrorInput): Translation {
  if (input.type === "VALIDATION_FAILED") {
    const missing = input.missing ?? [];
    const warnings = input.warnings ?? [];
    const fields = [...missing.map((item) => toField(item, false)), ...warnings.map((item) => toField(item, true))];
    const hasFormMissing = missing.some((item) => isFormField(item.field));
    const hasFiscalMissing = missing.some((item) => !isFormField(item.field));

    let actions: Translation["actions"];
    if (hasFormMissing && !hasFiscalMissing) {
      actions = [{ label: "Voltar ao formulário", kind: "button" }];
    } else if (hasFiscalMissing && !hasFormMissing) {
      actions = configActions(input.companyId);
    } else {
      actions = [
        {
          label: "Abrir Config fiscal",
          href: input.companyId ? `/app/companies/${input.companyId}/settings?returnTo=%2Fapp%2Fnfses` : "/app/companies",
          kind: "link",
        },
        { label: "Voltar ao formulário", kind: "button" },
      ];
    }

    return {
      title: "Faltam dados para emitir",
      message: "Complete os dados obrigatórios antes de emitir a NFS-e.",
      severity: "warning",
      fields,
      actions,
    };
  }

  if (input.type === "PROVIDER_REJECTED") {
    const code = input.errorCode ?? "";
    if (code === "E_VALUE") {
      return {
        title: "Valor do serviço inválido",
        message: "Informe um valor maior que zero para continuar.",
        severity: "warning",
        fields: [{ field: "serviceValue", label: "Valor do serviço", suggestion: "Use um valor acima de 0,00." }],
        actions: [{ label: "Tentar novamente", kind: "button" }],
      };
    }
    if (code === "E_DESC") {
      return {
        title: "Descrição do serviço ausente",
        message: "A emissão foi rejeitada porque a descrição do serviço está vazia.",
        severity: "warning",
        fields: [
          {
            field: "serviceDescription",
            label: "Descrição do serviço",
            suggestion: "Preencha no formulário ou defina uma descrição padrão na Config fiscal.",
          },
        ],
        actions: configActions(input.companyId),
      };
    }
    if (code === "E_TAXPAYER") {
      return {
        title: "Cadastro do prestador inválido",
        message: "O provider recusou os dados cadastrais do prestador.",
        severity: "error",
        fields: [
          { field: "company.cnpj", label: "CNPJ", suggestion: "Revise o CNPJ da empresa." },
          { field: "company.municipal_registration", label: "Inscrição municipal", suggestion: "Confira a IM cadastrada." },
          {
            field: "settings.municipality_name",
            label: "Município/UF",
            suggestion: "Valide município e UF na Config fiscal.",
          },
        ],
        actions: configActions(input.companyId),
      };
    }
  }

  return {
    title: "Erro ao emitir",
    message: normalizeMessage(input.errorMessage),
    severity: "error",
    actions: [{ label: "Tentar novamente", kind: "button" }],
  };
}
