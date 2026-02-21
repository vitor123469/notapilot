import { NextResponse } from "next/server";

import type { IssueDraft } from "../../../../src/lib/fiscal/contracts";
import { mockNfseNacionalProvider } from "../../../../src/lib/fiscal/providers/mockNfseNacional";
import { getSupabaseAdmin } from "../../../../src/lib/supabase/admin";

export const runtime = "nodejs";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing Authorization Bearer token" }, { status: 401 });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return NextResponse.json({ error: "Invalid bearer token" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized token" }, { status: 401 });
  }

  let body: IssueDraft;
  try {
    body = (await request.json()) as IssueDraft;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const tenantId = body.tenantId?.trim();
  const companyId = body.companyId?.trim();
  const clientId = body.clientId?.trim() || null;
  const idempotencyKey = body.idempotencyKey?.trim();
  const serviceDescription = body.serviceDescription?.trim() ?? "";
  const serviceValue = Number(body.serviceValue);
  const competenceDate = body.competenceDate?.trim() || null;

  if (!tenantId || !companyId || !idempotencyKey) {
    return badRequest("tenantId, companyId e idempotencyKey são obrigatórios.");
  }

  if (!Number.isFinite(serviceValue)) {
    return badRequest("serviceValue inválido.");
  }

  const { data: membership, error: membershipError } = await admin
    .from("tenant_members")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  if (!membership) {
    return NextResponse.json({ error: "Forbidden tenant access" }, { status: 403 });
  }

  const { data: company, error: companyError } = await admin
    .from("companies")
    .select("id, cnpj")
    .eq("id", companyId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (companyError) {
    return NextResponse.json({ error: companyError.message }, { status: 500 });
  }

  if (!company) {
    return NextResponse.json({ error: "Company not found for tenant" }, { status: 404 });
  }

  const { data: existingNfse, error: existingError } = await admin
    .from("nfses")
    .select("id, status, provider_nfse_number, error_message")
    .eq("tenant_id", tenantId)
    .eq("company_id", companyId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existingNfse) {
    return NextResponse.json({
      nfseId: existingNfse.id,
      status: existingNfse.status,
      providerNfseNumber: existingNfse.provider_nfse_number,
      errorMessage: existingNfse.error_message,
    });
  }

  const { data: createdNfse, error: createNfseError } = await admin
    .from("nfses")
    .insert({
      tenant_id: tenantId,
      company_id: companyId,
      client_id: clientId,
      idempotency_key: idempotencyKey,
      provider: "nfse_nacional",
      status: "submitted",
      service_description: serviceDescription,
      service_value: serviceValue,
      competence_date: competenceDate,
      raw_request: {
        stage: "submitted",
        source: "api/nfse/issue",
      },
    })
    .select("id")
    .single();

  if (createNfseError) {
    return NextResponse.json({ error: createNfseError.message }, { status: 500 });
  }

  const nfseId = createdNfse.id;
  const { error: submittedEventError } = await admin.from("nfse_events").insert({
    tenant_id: tenantId,
    nfse_id: nfseId,
    event_type: "ISSUE_SUBMITTED",
    payload: {
      idempotencyKey,
      companyId,
      clientId,
      serviceValue,
    },
  });

  if (submittedEventError) {
    return NextResponse.json({ error: submittedEventError.message }, { status: 500 });
  }

  const providerResult = await mockNfseNacionalProvider.issue({
    tenantId,
    companyId,
    clientId: clientId ?? undefined,
    idempotencyKey,
    serviceDescription,
    serviceValue,
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
        raw_request: providerResult.rawRequest ?? null,
        raw_response: providerResult.rawResponse ?? null,
        error_code: null,
        error_message: null,
      })
      .eq("tenant_id", tenantId)
      .eq("id", nfseId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { error: authorizedEventError } = await admin.from("nfse_events").insert({
      tenant_id: tenantId,
      nfse_id: nfseId,
      event_type: "ISSUE_AUTHORIZED",
      payload: {
        providerRequestId: providerResult.providerRequestId,
        providerNfseNumber: providerResult.providerNfseNumber ?? null,
        rawResponse: providerResult.rawResponse ?? null,
      },
    });

    if (authorizedEventError) {
      return NextResponse.json({ error: authorizedEventError.message }, { status: 500 });
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
      raw_request: providerResult.rawRequest ?? null,
      raw_response: providerResult.rawResponse ?? null,
      error_code: providerResult.errorCode ?? null,
      error_message: providerResult.errorMessage ?? "Emissão rejeitada pelo provider mock.",
    })
    .eq("tenant_id", tenantId)
    .eq("id", nfseId);

  if (rejectUpdateError) {
    return NextResponse.json({ error: rejectUpdateError.message }, { status: 500 });
  }

  const { error: rejectedEventError } = await admin.from("nfse_events").insert({
    tenant_id: tenantId,
    nfse_id: nfseId,
    event_type: "ISSUE_REJECTED",
    payload: {
      providerRequestId: providerResult.providerRequestId,
      errorCode: providerResult.errorCode ?? null,
      errorMessage: providerResult.errorMessage ?? null,
      rawResponse: providerResult.rawResponse ?? null,
    },
  });

  if (rejectedEventError) {
    return NextResponse.json({ error: rejectedEventError.message }, { status: 500 });
  }

  return NextResponse.json({
    nfseId,
    status: "rejected",
    errorMessage: providerResult.errorMessage ?? "Emissão rejeitada pelo provider mock.",
  });
}
