import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "../../../../src/lib/supabase/admin";

export const runtime = "nodejs";

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

export async function POST(request: Request) {
  const form = await request.formData();
  const params = Object.fromEntries(form.entries());
  const raw = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]));

  const from = String(params.From ?? "");
  const to = String(params.To ?? "");
  const body = String(params.Body ?? "");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tenantId = process.env.TWILIO_DEFAULT_TENANT_ID?.trim();
  const companyId = process.env.TWILIO_DEFAULT_COMPANY_ID?.trim() || null;

  if (!tenantId) {
    return twimlMessage("Webhook ok, mas falta configurar TWILIO_DEFAULT_TENANT_ID no server");
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return twimlMessage("Webhook ok, mas falta configurar Supabase no server.");
  }

  const replyText = `NotaPilot recebeu: ${body || "(mensagem vazia)"}. Digite HELP para comandos.`;

  try {
    const admin = getSupabaseAdmin();

    await admin.from("whatsapp_messages").insert({
      tenant_id: tenantId,
      company_id: companyId,
      direction: "inbound",
      from_number: from || null,
      to_number: to || null,
      body: body || null,
      raw,
    });

    await admin.from("whatsapp_messages").insert({
      tenant_id: tenantId,
      company_id: companyId,
      direction: "outbound",
      from_number: to || null,
      to_number: from || null,
      body: replyText,
      raw: { reply: true },
    });
  } catch {
    return twimlMessage("Recebemos sua mensagem, mas ocorreu um erro interno ao registrar o webhook.");
  }

  return twimlMessage(replyText);
}
