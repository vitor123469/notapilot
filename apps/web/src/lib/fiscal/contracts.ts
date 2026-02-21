import type { Json } from "../supabase/db.types";

export type Money = number;

export type NfseStatus =
  | "draft"
  | "submitted"
  | "authorized"
  | "rejected"
  | "cancel_requested"
  | "cancelled"
  | "substitute_requested"
  | "substituted";

export type IssueDraft = {
  tenantId: string;
  companyId: string;
  clientId?: string;
  idempotencyKey: string;
  serviceDescription: string;
  serviceValue: Money;
  competenceDate?: string;
};

export type ProviderError = {
  code: string;
  message: string;
};

export type ProviderIssueResult = {
  status: Extract<NfseStatus, "authorized" | "rejected" | "submitted">;
  providerRequestId: string;
  providerNfseNumber?: string;
  rawRequest?: Json;
  rawResponse?: Json;
  errorCode?: string;
  errorMessage?: string;
};

export type ProviderConsultResult = {
  status: NfseStatus;
  providerRequestId: string;
  providerNfseNumber?: string;
  rawResponse?: Json;
  error?: ProviderError;
};

export type ProviderCancelResult = {
  status: Extract<NfseStatus, "cancel_requested" | "cancelled" | "rejected">;
  providerRequestId: string;
  rawResponse?: Json;
  error?: ProviderError;
};
