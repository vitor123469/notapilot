import type { ProviderIssueResult } from "../contracts";
import type { FiscalProvider, ProviderIssueDraft } from "../provider";

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function randomNfseNumber(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export class MockNfseNacionalProvider implements FiscalProvider {
  async issue(draft: ProviderIssueDraft): Promise<ProviderIssueResult> {
    const providerRequestId = randomId("mock_req");

    const rawRequest = {
      provider: "mock_nfse_nacional",
      tenantId: draft.tenantId,
      companyId: draft.companyId,
      clientId: draft.clientId ?? null,
      companyCnpj: draft.companyCnpj ?? null,
      serviceDescription: draft.serviceDescription,
      serviceValue: draft.serviceValue,
      competenceDate: draft.competenceDate ?? null,
      idempotencyKey: draft.idempotencyKey,
    };

    if (draft.serviceValue <= 0) {
      return {
        status: "rejected",
        providerRequestId,
        errorCode: "E_VALUE",
        errorMessage: "Valor do serviço deve ser maior que zero.",
        rawRequest,
        rawResponse: {
          accepted: false,
          reason: "service_value_invalid",
          code: "E_VALUE",
        },
      };
    }

    if (!draft.serviceDescription.trim()) {
      return {
        status: "rejected",
        providerRequestId,
        errorCode: "E_DESC",
        errorMessage: "Descrição do serviço é obrigatória.",
        rawRequest,
        rawResponse: {
          accepted: false,
          reason: "service_description_missing",
          code: "E_DESC",
        },
      };
    }

    if ((draft.companyCnpj ?? "").startsWith("0")) {
      return {
        status: "rejected",
        providerRequestId,
        errorCode: "E_TAXPAYER",
        errorMessage: "Contribuinte inválido no provider mock.",
        rawRequest,
        rawResponse: {
          accepted: false,
          reason: "taxpayer_invalid",
          code: "E_TAXPAYER",
        },
      };
    }

    const providerNfseNumber = randomNfseNumber();
    return {
      status: "authorized",
      providerRequestId,
      providerNfseNumber,
      rawRequest,
      rawResponse: {
        accepted: true,
        protocol: randomId("mock_protocol"),
        nfseNumber: providerNfseNumber,
      },
    };
  }

  async consult(params: {
    tenantId: string;
    nfseId: string;
    providerRequestId?: string;
  }) {
    return {
      status: "submitted" as const,
      providerRequestId: params.providerRequestId ?? randomId("mock_req"),
      rawResponse: {
        provider: "mock_nfse_nacional",
        note: "Consulta simulada no mock.",
      },
    };
  }

  async cancel(params: { tenantId: string; nfseId: string; reason?: string }) {
    return {
      status: "cancel_requested" as const,
      providerRequestId: randomId("mock_req"),
      rawResponse: {
        provider: "mock_nfse_nacional",
        note: "Cancelamento simulado no mock.",
        reason: params.reason ?? null,
      },
    };
  }

  async substitute(params: { tenantId: string; nfseId: string; substituteReason?: string }) {
    return {
      status: "substitute_requested" as const,
      providerRequestId: randomId("mock_req"),
      rawResponse: {
        provider: "mock_nfse_nacional",
        note: "Substituição simulada no mock.",
        substituteReason: params.substituteReason ?? null,
      },
    };
  }
}

export const mockNfseNacionalProvider = new MockNfseNacionalProvider();
