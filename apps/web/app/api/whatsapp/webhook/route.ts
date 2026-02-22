import { NextResponse } from "next/server";

import { mockNfseNacionalProvider } from "../../../../src/lib/fiscal/providers/mockNfseNacional";
import { validateCompanyForIssuance } from "../../../../src/lib/fiscal/validateCompanyForIssuance";
import { getActiveCompanyId, setActiveCompanyId } from "../../../../src/lib/whatsapp/sessionStore";
import { getSupabaseAdmin } from "../../../../src/lib/supabase/admin";

export const runtime = "nodejs";

const HELP_FOOTER = "Digite HELP para comandos";

type CommandResult = {
  replyText: string;
  companyIdForLog: string | null;
};

type CompanyItem = {
  id: string;
  legal_name: string;
};

type NfseListItem = {
  id: string;
  status: string;
  provider_nfse_number: string | null;
  service_value: number;
  created_at: string;
};

function escapeXml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function twimlMessage(message: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

export async function GET() {
  return new NextResponse("ok", { status: 200 });
}

function withFooter(lines: string[]): string {
  const normalized = lines.map((line) => line.trim()).filter(Boolean);
  if (!normalized.length) {
    return HELP_FOOTER;
  }

  if (normalized[normalized.length - 1] !== HELP_FOOTER) {
    normalized.push(HELP_FOOTER);
  }

  return normalized.join("\n");
}

function parseServiceValue(input: string): number | null {
  const normalized = input.trim().replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

async function handleEmitirCommand(input: {
  tenantId: string;
  companyId: string;
  messageSid: string;
  emitArgs: string;
}): Promise<string> {
  const match = input.emitArgs.match(/^([^\s]+)\s+(.+)$/);
  if (!match) {
    return withFooter(["Formato: EMITIR <valor> <descricao>"]);
  }

  const rawValue = match[1] ?? "";
  const description = (match[2] ?? "").trim();
  const serviceValue = parseServiceValue(rawValue);

  if (!serviceValue) {
    return withFooter(["Valor invalido. Exemplo: EMITIR 50 consultoria"]);
  }

  if (!description) {
    return withFooter(["Descricao obrigatoria. Exemplo: EMITIR 50 consultoria"]);
  }

  let readiness;
  try {
    readiness = await validateCompanyForIssuance({
      tenantId: input.tenantId,
      companyId: input.companyId,
      serviceDescription: description,
      serviceValue,
    });
  } catch {
    return withFooter(["Falha ao validar dados fiscais da empresa."]);
  }

  if (!readiness.ok) {
    const labels = readiness.missing.slice(0, 3).map((item) => item.label);
    const pendencias =
      labels.length > 0 ? `Pendencias: ${labels.join("; ")}` : "Pendencias fiscais encontradas.";
    return withFooter([pendencias, "Abra Config fiscal no app."]);
  }

  const normalizedServiceValue = readiness.snapshot.serviceValue;
  if (normalizedServiceValue === null) {
    return withFooter(["Valor do servico invalido para emissao."]);
  }

  const company = readiness.snapshot.company;
  if (!company) {
    return withFooter(["Empresa nao encontrada para este tenant."]);
  }

  const admin = getSupabaseAdmin();
  const idempotencyKey = `wa:${input.messageSid}`;

  const { data: existingNfse, error: existingError } = await admin
    .from("nfses")
    .select("id, status, provider_nfse_number, error_message")
    .eq("tenant_id", input.tenantId)
    .eq("company_id", input.companyId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle<{
      id: string;
      status: string;
      provider_nfse_number: string | null;
      error_message: string | null;
    }>();

  if (existingError) {
    return withFooter(["Falha ao validar idempotencia da emissao."]);
  }

  if (existingNfse) {
    if (existingNfse.status === "authorized") {
      return withFooter([`Emitida: ${existingNfse.provider_nfse_number ?? existingNfse.id} (status authorized)`]);
    }
    return withFooter([
      `Rejeitada: ${existingNfse.error_message ?? "emissao previamente rejeitada."}`,
    ]);
  }

  const { data: upsertedNfse, error: upsertError } = await admin
    .from("nfses")
    .upsert(
      {
        tenant_id: input.tenantId,
        company_id: input.companyId,
        idempotency_key: idempotencyKey,
        provider: "nfse_nacional",
        status: "submitted",
        service_description: description,
        service_value: normalizedServiceValue,
      },
      { onConflict: "tenant_id,company_id,idempotency_key", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle<{ id: string }>();

  if (upsertError) {
    return withFooter(["Falha ao registrar emissao idempotente."]);
  }

  let nfseId = upsertedNfse?.id ?? null;
  if (!nfseId) {
    const { data: selectedAfterConflict, error: selectAfterConflictError } = await admin
      .from("nfses")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .eq("company_id", input.companyId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle<{ id: string }>();

    if (selectAfterConflictError || !selectedAfterConflict?.id) {
      return withFooter(["Falha ao recuperar emissao apos conflito de idempotencia."]);
    }
    nfseId = selectedAfterConflict.id;
  }

  const { error: submittedEventError } = await admin.from("nfse_events").insert({
    tenant_id: input.tenantId,
    nfse_id: nfseId,
    event_type: "ISSUE_SUBMITTED",
    payload: { idempotencyKey, source: "whatsapp" },
  });
  if (submittedEventError) {
    return withFooter(["Falha ao registrar evento de submissao."]);
  }

  const providerResult = await mockNfseNacionalProvider.issue({
    tenantId: input.tenantId,
    companyId: input.companyId,
    idempotencyKey,
    serviceDescription: description,
    serviceValue: normalizedServiceValue,
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
      .eq("tenant_id", input.tenantId)
      .eq("id", nfseId);

    if (updateError) {
      return withFooter(["Falha ao atualizar NFS-e autorizada."]);
    }

    await admin.from("nfse_events").insert({
      tenant_id: input.tenantId,
      nfse_id: nfseId,
      event_type: "ISSUE_AUTHORIZED",
      payload: {
        providerRequestId: providerResult.providerRequestId,
        providerNfseNumber: providerResult.providerNfseNumber ?? null,
      },
    });

    return withFooter([`Emitida: ${providerResult.providerNfseNumber ?? nfseId} (status authorized)`]);
  }

  const errorMessage = providerResult.errorMessage ?? "Emissao rejeitada pelo provider mock.";
  const { error: rejectUpdateError } = await admin
    .from("nfses")
    .update({
      status: "rejected",
      provider_request_id: providerResult.providerRequestId,
      raw_request: providerResult.rawRequest ?? null,
      raw_response: providerResult.rawResponse ?? null,
      error_code: providerResult.errorCode ?? null,
      error_message: errorMessage,
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", nfseId);

  if (rejectUpdateError) {
    return withFooter(["Falha ao atualizar NFS-e rejeitada."]);
  }

  await admin.from("nfse_events").insert({
    tenant_id: input.tenantId,
    nfse_id: nfseId,
    event_type: "ISSUE_REJECTED",
    payload: {
      providerRequestId: providerResult.providerRequestId,
      errorCode: providerResult.errorCode ?? null,
      errorMessage,
    },
  });

  return withFooter([`Rejeitada: ${errorMessage}`]);
}

async function routeCommand(input: {
  tenantId: string;
  from: string;
  text: string;
  upper: string;
  messageSid: string;
}): Promise<CommandResult> {
  const admin = getSupabaseAdmin();
  const { tenantId, from, text, upper, messageSid } = input;
  const defaultCompanyId = process.env.TWILIO_DEFAULT_COMPANY_ID?.trim() || null;

  if (!upper || upper === "HELP") {
    return {
      replyText: withFooter([
        "Comandos:",
        "HELP | EMPRESAS",
        "USAR <idPrefix>",
        "STATUS",
        "EMITIR <valor> <descricao>",
      ]),
      companyIdForLog: defaultCompanyId,
    };
  }

  if (upper === "EMPRESAS") {
    const { data: companies, error } = await admin
      .from("companies")
      .select("id, legal_name")
      .eq("tenant_id", tenantId)
      .order("legal_name", { ascending: true })
      .limit(10)
      .returns<CompanyItem[]>();

    if (error) {
      return {
        replyText: withFooter(["Falha ao listar empresas. Tente novamente."]),
        companyIdForLog: defaultCompanyId,
      };
    }

    if (!companies?.length) {
      return {
        replyText: withFooter(["Nenhuma empresa encontrada neste tenant."]),
        companyIdForLog: defaultCompanyId,
      };
    }

    return {
      replyText: withFooter([
        ...companies.map((company) => `${company.id.slice(0, 8)} - ${company.legal_name}`),
        "Use: USAR <idPrefix>",
      ]),
      companyIdForLog: defaultCompanyId,
    };
  }

  if (upper.startsWith("USAR ")) {
    const prefix = text.slice(5).trim().toLowerCase();
    if (!prefix) {
      return {
        replyText: withFooter(["Informe prefixo. Exemplo: USAR abc123"]),
        companyIdForLog: defaultCompanyId,
      };
    }

    const { data: companies, error } = await admin
      .from("companies")
      .select("id, legal_name")
      .eq("tenant_id", tenantId)
      .returns<CompanyItem[]>();

    if (error) {
      return {
        replyText: withFooter(["Falha ao buscar empresas."]),
        companyIdForLog: defaultCompanyId,
      };
    }

    const matches = (companies ?? []).filter((company) => company.id.toLowerCase().startsWith(prefix));

    if (matches.length === 0) {
      return {
        replyText: withFooter(["Nao achei. Envie EMPRESAS."]),
        companyIdForLog: defaultCompanyId,
      };
    }

    if (matches.length > 1) {
      return {
        replyText: withFooter(["Prefixo ambiguo, envie mais caracteres."]),
        companyIdForLog: defaultCompanyId,
      };
    }

    const selected = matches[0];
    if (!selected) {
      return {
        replyText: withFooter(["Nao achei. Envie EMPRESAS."]),
        companyIdForLog: defaultCompanyId,
      };
    }

    await setActiveCompanyId({ tenantId, fromNumber: from, companyId: selected.id });
    return {
      replyText: withFooter([`Empresa ativa: ${selected.legal_name}`]),
      companyIdForLog: selected.id,
    };
  }

  if (upper === "STATUS") {
    const activeCompanyId = await getActiveCompanyId({ tenantId, fromNumber: from });
    if (!activeCompanyId) {
      return {
        replyText: withFooter(["Envie EMPRESAS e depois USAR <idPrefix>."]),
        companyIdForLog: null,
      };
    }

    const { data: nfses, error } = await admin
      .from("nfses")
      .select("id, status, provider_nfse_number, service_value, created_at")
      .eq("tenant_id", tenantId)
      .eq("company_id", activeCompanyId)
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<NfseListItem[]>();

    if (error) {
      return {
        replyText: withFooter(["Falha ao buscar status."]),
        companyIdForLog: activeCompanyId,
      };
    }

    if (!nfses?.length) {
      return {
        replyText: withFooter(["Sem NFS-e recentes para esta empresa."]),
        companyIdForLog: activeCompanyId,
      };
    }

    return {
      replyText: withFooter(
        nfses.map((item) => {
          const number = item.provider_nfse_number ?? item.id.slice(0, 8);
          const when = item.created_at.slice(0, 10);
          return `${number} | ${item.status} | ${formatCurrency(item.service_value)} | ${when}`;
        })
      ),
      companyIdForLog: activeCompanyId,
    };
  }

  if (upper.startsWith("EMITIR")) {
    const activeCompanyId = await getActiveCompanyId({ tenantId, fromNumber: from });
    if (!activeCompanyId) {
      return {
        replyText: withFooter(["Envie EMPRESAS e depois USAR <idPrefix>."]),
        companyIdForLog: null,
      };
    }

    if (!messageSid) {
      return {
        replyText: withFooter(["Mensagem sem MessageSid. Tente novamente."]),
        companyIdForLog: activeCompanyId,
      };
    }

    const emitArgs = text.slice("EMITIR".length).trim();
    const replyText = await handleEmitirCommand({
      tenantId,
      companyId: activeCompanyId,
      messageSid,
      emitArgs,
    });
    return {
      replyText,
      companyIdForLog: activeCompanyId,
    };
  }

  return {
    replyText: withFooter(["Comando nao reconhecido. Envie HELP."]),
    companyIdForLog: defaultCompanyId,
  };
}

export async function POST(request: Request) {
  const form = await request.formData();
  const params = Object.fromEntries(form.entries());
  const raw = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]));

  const from = String(params.From ?? "");
  const to = String(params.To ?? "");
  const body = String(params.Body ?? "");
  const messageSid = String(params.MessageSid ?? "");
  const text = body.trim();
  const upper = text.toUpperCase();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tenantId = process.env.TWILIO_DEFAULT_TENANT_ID?.trim();

  if (!tenantId) {
    return twimlMessage(withFooter(["Webhook ok, mas falta TWILIO_DEFAULT_TENANT_ID no server."]));
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return twimlMessage(withFooter(["Webhook ok, mas falta configurar Supabase no server."]));
  }

  let commandResult: CommandResult = {
    replyText: withFooter(["Erro interno ao processar comando."]),
    companyIdForLog: process.env.TWILIO_DEFAULT_COMPANY_ID?.trim() || null,
  };

  try {
    const admin = getSupabaseAdmin();

    await admin.from("whatsapp_messages").insert({
      tenant_id: tenantId,
      company_id: null,
      direction: "inbound",
      from_number: from || null,
      to_number: to || null,
      body: body || null,
      raw,
    });

    commandResult = await routeCommand({
      tenantId,
      from,
      text,
      upper,
      messageSid,
    });

    await admin.from("whatsapp_messages").insert({
      tenant_id: tenantId,
      company_id: commandResult.companyIdForLog,
      direction: "outbound",
      from_number: to || null,
      to_number: from || null,
      body: commandResult.replyText,
      raw: { reply: true, command: upper.split(" ")[0] || "HELP" },
    });
  } catch {
    return twimlMessage(withFooter(["Recebemos sua mensagem, mas houve erro interno no webhook."]));
  }

  return twimlMessage(commandResult.replyText);
}
