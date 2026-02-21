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

  async cancel(params: {
    tenantId: string;
    nfseId: string;
    providerRequestId?: string;
    providerNfseNumber?: string;
    reason?: string;
  }) {
    const providerRequestId = params.providerRequestId ?? randomId("mock_req");
    const reason = params.reason?.trim() ?? "";
    const providerNfseNumber = params.providerNfseNumber?.trim() ?? "";

    if (!providerNfseNumber) {
      return {
        status: "rejected" as const,
        providerRequestId,
        errorCode: "E_NO_NUMBER",
        errorMessage: "NFS-e sem número do provider para cancelamento.",
        error: { code: "E_NO_NUMBER", message: "NFS-e sem número do provider para cancelamento." },
        rawResponse: {
          provider: "mock_nfse_nacional",
          accepted: false,
          code: "E_NO_NUMBER",
        },
      };
    }

    if (!reason) {
      return {
        status: "rejected" as const,
        providerRequestId,
        providerNfseNumber,
        errorCode: "E_REASON",
        errorMessage: "Motivo do cancelamento é obrigatório.",
        error: { code: "E_REASON", message: "Motivo do cancelamento é obrigatório." },
        rawResponse: {
          provider: "mock_nfse_nacional",
          accepted: false,
          code: "E_REASON",
        },
      };
    }

    return {
      status: "cancelled" as const,
      providerRequestId,
      providerNfseNumber,
      rawResponse: {
        provider: "mock_nfse_nacional",
        note: "Cancelamento simulado no mock.",
        reason,
        cancelledAt: new Date().toISOString(),
      },
    };
  }

  async substitute(params: {
    tenantId: string;
    nfseId: string;
    providerRequestId?: string;
    oldNfseNumber?: string;
    reason?: string;
  }) {
    const providerRequestId = params.providerRequestId ?? randomId("mock_req");
    const oldNfseNumber = params.oldNfseNumber?.trim() ?? "";
    const reason = params.reason?.trim() ?? "";

    if (!oldNfseNumber) {
      return {
        status: "rejected" as const,
        providerRequestId,
        errorCode: "E_NO_NUMBER",
        errorMessage: "NFS-e sem número anterior para substituição.",
        error: { code: "E_NO_NUMBER", message: "NFS-e sem número anterior para substituição." },
        rawResponse: {
          provider: "mock_nfse_nacional",
          accepted: false,
          code: "E_NO_NUMBER",
        },
      };
    }

    if (!reason) {
      return {
        status: "rejected" as const,
        providerRequestId,
        oldNfseNumber,
        errorCode: "E_REASON",
        errorMessage: "Motivo da substituição é obrigatório.",
        error: { code: "E_REASON", message: "Motivo da substituição é obrigatório." },
        rawResponse: {
          provider: "mock_nfse_nacional",
          accepted: false,
          code: "E_REASON",
        },
      };
    }

    const newNfseNumber = randomNfseNumber();
    return {
      status: "substituted" as const,
      providerRequestId,
      providerNfseNumber: newNfseNumber,
      oldNfseNumber,
      rawResponse: {
        provider: "mock_nfse_nacional",
        note: "Substituição simulada no mock.",
        reason,
        oldNumber: oldNfseNumber,
        newNumber: newNfseNumber,
      },
    };
  }
}

export const mockNfseNacionalProvider = new MockNfseNacionalProvider();
