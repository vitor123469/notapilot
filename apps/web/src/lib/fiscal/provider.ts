import type { IssueDraft, ProviderCancelResult, ProviderConsultResult, ProviderIssueResult } from "./contracts";

export type ProviderIssueDraft = IssueDraft & {
  companyCnpj?: string;
};

export interface FiscalProvider {
  issue(draft: ProviderIssueDraft): Promise<ProviderIssueResult>;
  consult(params: {
    tenantId: string;
    nfseId: string;
    providerRequestId?: string;
  }): Promise<ProviderConsultResult>;
  cancel(params: {
    tenantId: string;
    nfseId: string;
    reason?: string;
  }): Promise<ProviderCancelResult>;
  substitute(params: {
    tenantId: string;
    nfseId: string;
    substituteReason?: string;
  }): Promise<ProviderConsultResult>;
}
