import { NextResponse } from "next/server";

import type { Json } from "../../../../src/lib/supabase/db.types";
import { mockNfseNacionalProvider } from "../../../../src/lib/fiscal/providers/mockNfseNacional";
import { validateCompanyForIssuance } from "../../../../src/lib/fiscal/validateCompanyForIssuance";
import { getSupabaseAdmin } from "../../../../src/lib/supabase/admin";

export const runtime = "nodejs";

type IssueRequestBody = {
  tenantId?: string;
  companyId?: string;
  clientId?: string;
  idempotencyKey?: string;
  serviceDescription?: string;
  serviceValue?: number;
  competenceDate?: string;
  dryRun?: boolean;
};

type NfseSummary = {
  id: string;
  status: string;
  provider_nfse_number: string | null;
  error_code: string | null;
  error_message: string | null;
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

function formatNfseResponse(nfse: NfseSummary) {
  return {
    nfseId: nfse.id,
    status: nfse.status,
    providerNfseNumber: nfse.provider_nfse_number ?? undefined,
    errorCode: nfse.error_code ?? undefined,
    errorMessage: nfse.error_message ?? undefined,
  };
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

  let body: IssueRequestBody;
  try {
    body = (await request.json()) as IssueRequestBody;
  } catch {
    return apiError(400, "BAD_REQUEST", "JSON inválido.");
  }

  const tenantId = body.tenantId?.trim();
  const companyId = body.companyId?.trim();
  const clientId = body.clientId?.trim() || null;
  const idempotencyKey = body.idempotencyKey?.trim();
  const providedServiceDescription = body.serviceDescription?.trim() ?? "";
  const parsedServiceValue = Number(body.serviceValue);
  const serviceValue = Number.isFinite(parsedServiceValue) ? parsedServiceValue : undefined;
  const competenceDate = body.competenceDate?.trim() || null;
  const dryRun = Boolean(body.dryRun);

  if (!tenantId || !companyId || !idempotencyKey) {
    return apiError(400, "BAD_REQUEST", "tenantId, companyId e idempotencyKey são obrigatórios.");
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

  let readiness;
  try {
    readiness = await validateCompanyForIssuance({
      tenantId,
      companyId,
      serviceDescription: providedServiceDescription,
      serviceValue,
    });
  } catch {
    return apiError(500, "VALIDATION_LOOKUP_FAILED", "Falha ao buscar dados fiscais da empresa.");
  }

  if (!readiness.ok) {
    return NextResponse.json(
      {
        error: "VALIDATION_FAILED",
        missing: readiness.missing,
        warnings: readiness.warnings,
      },
      { status: 422 }
    );
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      missing: readiness.missing,
      warnings: readiness.warnings,
      snapshot: readiness.snapshot,
    });
  }

  const company = readiness.snapshot.company;
  if (!company) {
    return apiError(404, "COMPANY_NOT_FOUND", "Empresa não encontrada para o tenant.");
  }

  const serviceDescription = readiness.snapshot.effectiveServiceDescription;
  const normalizedServiceValue = readiness.snapshot.serviceValue;
  if (normalizedServiceValue === null) {
    return apiError(422, "VALIDATION_FAILED", "Valor do serviço inválido.");
  }

  const { data: existingNfse, error: existingError } = await admin
    .from("nfses")
    .select("id, status, provider_nfse_number, error_code, error_message")
    .eq("tenant_id", tenantId)
    .eq("company_id", companyId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle<NfseSummary>();

  if (existingError) {
    return apiError(500, "IDEMPOTENCY_LOOKUP_FAILED", "Falha ao buscar emissão idempotente.");
  }

  if (existingNfse) {
    return NextResponse.json(formatNfseResponse(existingNfse));
  }

  const { data: upsertedNfse, error: upsertError } = await admin
    .from("nfses")
    .upsert(
      {
        tenant_id: tenantId,
        company_id: companyId,
        client_id: clientId,
        idempotency_key: idempotencyKey,
        provider: "nfse_nacional",
        status: "submitted",
        service_description: serviceDescription,
        service_value: normalizedServiceValue,
        competence_date: competenceDate,
      },
      { onConflict: "tenant_id,company_id,idempotency_key", ignoreDuplicates: true }
    )
    .select("id, status, provider_nfse_number, error_code, error_message")
    .maybeSingle<NfseSummary>();

  if (upsertError) {
    return apiError(500, "IDEMPOTENCY_UPSERT_FAILED", "Falha ao registrar emissão idempotente.");
  }

  let createdNow = Boolean(upsertedNfse?.id);
  let nfse = upsertedNfse ?? null;

  if (!nfse) {
    const { data: selectedAfterConflict, error: selectAfterConflictError } = await admin
      .from("nfses")
      .select("id, status, provider_nfse_number, error_code, error_message")
      .eq("tenant_id", tenantId)
      .eq("company_id", companyId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle<NfseSummary>();

    if (selectAfterConflictError) {
      return apiError(500, "IDEMPOTENCY_LOOKUP_FAILED", "Falha ao buscar emissão idempotente após conflito.");
    }
    if (!selectedAfterConflict) {
      return apiError(500, "IDEMPOTENCY_LOOKUP_FAILED", "Emissão idempotente não encontrada após conflito.");
    }

    nfse = selectedAfterConflict;
    createdNow = false;
  }

  if (!createdNow) {
    return NextResponse.json(formatNfseResponse(nfse));
  }

  const nfseId = nfse.id;
  const { error: submittedEventError } = await admin.from("nfse_events").insert({
    tenant_id: tenantId,
    nfse_id: nfseId,
    event_type: "ISSUE_SUBMITTED",
    payload: {
      idempotencyKey,
      serviceValue: normalizedServiceValue,
    },
  });

  if (submittedEventError) {
    return apiError(500, "EVENT_INSERT_FAILED", "Falha ao registrar evento ISSUE_SUBMITTED.");
  }

  const providerResult = await mockNfseNacionalProvider.issue({
    tenantId,
    companyId,
    clientId: clientId ?? undefined,
    idempotencyKey,
    serviceDescription,
    serviceValue: normalizedServiceValue,
    competenceDate: competenceDate ?? undefined,
    companyCnpj: company.cnpj,
  });

  if (providerResult.status === "authorized") {
    const { error: updateError } = await admin
      .from("nfses")
      .update({
        status: "authorized",
        provider_request_id: providerResult.providerRequestId,
        provider_nfse_number: providerResult.providerNfseNumber ?? null,
        issued_at: new Date().toISOString(),
        service_description: serviceDescription,
        service_value: normalizedServiceValue,
        raw_request: providerResult.rawRequest ?? null,
        raw_response: providerResult.rawResponse ?? null,
        error_code: null,
        error_message: null,
      })
      .eq("tenant_id", tenantId)
      .eq("id", nfseId);

    if (updateError) {
      return apiError(500, "NFSE_UPDATE_FAILED", "Falha ao atualizar NFS-e autorizada.");
    }

    const { error: authorizedEventError } = await admin.from("nfse_events").insert({
      tenant_id: tenantId,
      nfse_id: nfseId,
      event_type: "ISSUE_AUTHORIZED",
      payload: {
        providerRequestId: providerResult.providerRequestId,
        providerNfseNumber: providerResult.providerNfseNumber ?? null,
      },
    });

    if (authorizedEventError) {
      return apiError(500, "EVENT_INSERT_FAILED", "Falha ao registrar evento ISSUE_AUTHORIZED.");
    }

    const { error: auditError } = await admin.from("audit_log").insert({
      action: "NFSE_ISSUE",
      tenant_id: tenantId,
      actor_user_id: user.id,
      entity_table: "nfses",
      entity_id: nfseId,
      metadata: {
        status: "authorized",
        companyId,
        idempotencyKey,
        dryRun: false,
      },
    });

    if (auditError) {
      return apiError(500, "AUDIT_LOG_FAILED", "Falha ao registrar auditoria da emissão.");
    }

    return NextResponse.json({
      nfseId,
      status: "authorized",
      providerNfseNumber: providerResult.providerNfseNumber,
    });
  }

  const { error: rejectUpdateError } = await admin
    .from("nfses")
    .update({
      status: "rejected",
      provider_request_id: providerResult.providerRequestId,
      service_description: serviceDescription,
      service_value: normalizedServiceValue,
      raw_request: providerResult.rawRequest ?? null,
      raw_response: providerResult.rawResponse ?? null,
      error_code: providerResult.errorCode ?? null,
      error_message: providerResult.errorMessage ?? "Emissão rejeitada pelo provider mock.",
    })
    .eq("tenant_id", tenantId)
    .eq("id", nfseId);

  if (rejectUpdateError) {
    return apiError(500, "NFSE_UPDATE_FAILED", "Falha ao atualizar NFS-e rejeitada.");
  }

  const { error: rejectedEventError } = await admin.from("nfse_events").insert({
    tenant_id: tenantId,
    nfse_id: nfseId,
    event_type: "ISSUE_REJECTED",
    payload: {
      providerRequestId: providerResult.providerRequestId,
      errorCode: providerResult.errorCode ?? null,
      errorMessage: providerResult.errorMessage ?? null,
    },
  });

  if (rejectedEventError) {
    return apiError(500, "EVENT_INSERT_FAILED", "Falha ao registrar evento ISSUE_REJECTED.");
  }

  const { error: auditError } = await admin.from("audit_log").insert({
    action: "NFSE_ISSUE",
    tenant_id: tenantId,
    actor_user_id: user.id,
    entity_table: "nfses",
    entity_id: nfseId,
    metadata: {
      status: "rejected",
      companyId,
      idempotencyKey,
      dryRun: false,
    },
  });

  if (auditError) {
    return apiError(500, "AUDIT_LOG_FAILED", "Falha ao registrar auditoria da emissão.");
  }

  return NextResponse.json({
    nfseId,
    status: "rejected",
    errorCode: providerResult.errorCode,
    errorMessage: providerResult.errorMessage ?? "Emissão rejeitada pelo provider mock.",
  });
}
