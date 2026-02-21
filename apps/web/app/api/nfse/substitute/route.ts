import { NextResponse } from "next/server";

import { mockNfseNacionalProvider } from "../../../../src/lib/fiscal/providers/mockNfseNacional";
import type { Json } from "../../../../src/lib/supabase/db.types";
import { getSupabaseAdmin } from "../../../../src/lib/supabase/admin";

export const runtime = "nodejs";

type SubstituteRequestBody = {
  tenantId?: string;
  nfseId?: string;
  reason?: string;
};

type NfseForSubstitute = {
  id: string;
  status: string;
  provider_nfse_number: string | null;
  provider_request_id: string | null;
  raw_response: Json | null;
};

function apiError(status: number, code: string, message: string, details?: Record<string, Json>) {
  return NextResponse.json(
    {
      error: code,
      message,
      ...(details ?? {}),
    },
    { status }
  );
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return apiError(401, "UNAUTHORIZED", "Token Bearer ausente.");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return apiError(401, "UNAUTHORIZED", "Bearer token inválido.");
  }

  const admin = getSupabaseAdmin();
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);
  if (userError || !user) {
    return apiError(401, "UNAUTHORIZED", "Token inválido ou expirado.");
  }

  let body: SubstituteRequestBody;
  try {
    body = (await request.json()) as SubstituteRequestBody;
  } catch {
    return apiError(400, "BAD_REQUEST", "JSON inválido.");
  }

  const tenantId = body.tenantId?.trim();
  const nfseId = body.nfseId?.trim();
  const reason = body.reason?.trim() ?? "";

  if (!tenantId || !nfseId) {
    return apiError(400, "BAD_REQUEST", "tenantId e nfseId são obrigatórios.");
  }
  if (!reason) {
    return apiError(422, "E_REASON", "Motivo da substituição é obrigatório.");
  }

  const { data: membership, error: membershipError } = await admin
    .from("tenant_members")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membershipError) {
    return apiError(500, "MEMBERSHIP_LOOKUP_FAILED", "Falha ao validar membership do tenant.");
  }
  if (!membership) {
    return apiError(403, "FORBIDDEN", "Acesso ao tenant não permitido.");
  }

  const { data: nfse, error: nfseError } = await admin
    .from("nfses")
    .select("id, status, provider_nfse_number, provider_request_id, raw_response")
    .eq("tenant_id", tenantId)
    .eq("id", nfseId)
    .maybeSingle<NfseForSubstitute>();
  if (nfseError) {
    return apiError(500, "NFSE_LOOKUP_FAILED", "Falha ao buscar NFS-e.");
  }
  if (!nfse) {
    return apiError(404, "NOT_FOUND", "NFS-e não encontrada.");
  }
  if (nfse.status !== "authorized") {
    return apiError(409, "INVALID_STATUS", "Só é possível substituir NFS-e com status authorized.");
  }
  if (!nfse.provider_nfse_number) {
    return apiError(422, "E_NO_NUMBER", "NFS-e sem número do provider para substituição.");
  }

  const oldNumber = nfse.provider_nfse_number;
  const { error: requestUpdateError } = await admin
    .from("nfses")
    .update({ status: "substitute_requested" })
    .eq("tenant_id", tenantId)
    .eq("id", nfseId);
  if (requestUpdateError) {
    return apiError(500, "NFSE_UPDATE_FAILED", "Falha ao marcar substitute_requested.");
  }

  const { error: requestedEventError } = await admin.from("nfse_events").insert({
    tenant_id: tenantId,
    nfse_id: nfseId,
    event_type: "SUBSTITUTE_REQUESTED",
    payload: { reason },
  });
  if (requestedEventError) {
    return apiError(500, "EVENT_INSERT_FAILED", "Falha ao registrar evento SUBSTITUTE_REQUESTED.");
  }

  const providerResult = await mockNfseNacionalProvider.substitute({
    tenantId,
    nfseId,
    providerRequestId: nfse.provider_request_id ?? undefined,
    oldNfseNumber: oldNumber,
    reason,
  });
  if (providerResult.status !== "substituted" || !providerResult.providerNfseNumber) {
    return apiError(
      422,
      providerResult.errorCode ?? "SUBSTITUTE_REJECTED",
      providerResult.errorMessage ?? "Substituição rejeitada."
    );
  }

  const mergedRawResponse =
    nfse.raw_response && typeof nfse.raw_response === "object"
      ? {
          ...nfse.raw_response,
          oldNumber,
          substitution: providerResult.rawResponse ?? null,
        }
      : {
          oldNumber,
          substitution: providerResult.rawResponse ?? null,
        };

  const { error: substituteUpdateError } = await admin
    .from("nfses")
    .update({
      status: "substituted",
      provider_request_id: providerResult.providerRequestId,
      provider_nfse_number: providerResult.providerNfseNumber,
      raw_response: mergedRawResponse,
      error_code: null,
      error_message: null,
    })
    .eq("tenant_id", tenantId)
    .eq("id", nfseId);
  if (substituteUpdateError) {
    return apiError(500, "NFSE_UPDATE_FAILED", "Falha ao marcar NFS-e como substituted.");
  }

  const { error: substitutedEventError } = await admin.from("nfse_events").insert({
    tenant_id: tenantId,
    nfse_id: nfseId,
    event_type: "SUBSTITUTED",
    payload: { oldNumber, newNumber: providerResult.providerNfseNumber },
  });
  if (substitutedEventError) {
    return apiError(500, "EVENT_INSERT_FAILED", "Falha ao registrar evento SUBSTITUTED.");
  }

  const { error: auditError } = await admin.from("audit_log").insert({
    action: "NFSE_SUBSTITUTE",
    tenant_id: tenantId,
    actor_user_id: user.id,
    entity_table: "nfses",
    entity_id: nfseId,
    metadata: {
      status: "substituted",
      reason,
      oldNumber,
      newNumber: providerResult.providerNfseNumber,
    },
  });
  if (auditError) {
    return apiError(500, "AUDIT_LOG_FAILED", "Falha ao registrar auditoria da substituição.");
  }

  return NextResponse.json({
    ok: true,
    nfseId,
    status: "substituted",
    providerNfseNumber: providerResult.providerNfseNumber,
  });
}
