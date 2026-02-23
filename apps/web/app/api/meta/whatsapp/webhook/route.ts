import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import type { Json } from "../../../../../src/lib/supabase/db.types";
import { getSupabaseAdmin } from "../../../../../src/lib/supabase/admin";

export const runtime = "nodejs";

type MetaWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: {
          phone_number_id?: string;
        };
        messages?: Array<{
          type?: string;
          from?: string;
          text?: {
            body?: string;
          };
          [key: string]: unknown;
        }>;
      };
    }>;
  }>;
};

function verifyMetaSignature(rawBody: string, signatureHeader: string, appSecret: string): boolean {
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const provided = signatureHeader.trim();
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge") ?? "";

  if (mode === "subscribe" && verifyToken && verifyToken === process.env.META_WA_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ ok: false }, { status: 403 });
}

export async function POST(request: Request) {
  const tenantId = process.env.META_DEFAULT_TENANT_ID?.trim();
  const defaultCompanyId = process.env.META_DEFAULT_COMPANY_ID?.trim() || null;

  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "META_DEFAULT_TENANT_ID is required" }, { status: 500 });
  }

  const rawBody = await request.text();
  const appSecret = process.env.META_APP_SECRET?.trim();

  if (appSecret) {
    const signature = request.headers.get("X-Hub-Signature-256") ?? "";
    if (!signature || !verifyMetaSignature(rawBody, signature, appSecret)) {
      return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
    }
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const token = process.env.META_WA_ACCESS_TOKEN?.trim();
  const fallbackPhoneNumberId = process.env.META_WA_PHONE_NUMBER_ID?.trim() || null;
  const textMessages: Array<{ from: string; body: string; phoneNumberId: string | null; msg: Json }> = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) {
        continue;
      }

      const phoneNumberId = value.metadata?.phone_number_id || fallbackPhoneNumberId;
      for (const msg of value.messages ?? []) {
        if (msg.type !== "text") {
          continue;
        }
        const from = String(msg.from ?? "").trim();
        const body = String(msg.text?.body ?? "");
        if (!from) {
          continue;
        }
        textMessages.push({
          from,
          body,
          phoneNumberId,
          msg: msg as Json,
        });
      }
    }
  }

  if (!textMessages.length) {
    return NextResponse.json({ ok: true });
  }

  for (const message of textMessages) {
    const replyText = `NotaPilot recebeu: ${message.body}\nDigite HELP para comandos.`;

    await admin.from("whatsapp_messages").insert({
      tenant_id: tenantId,
      company_id: defaultCompanyId,
      direction: "inbound",
      from_number: message.from,
      to_number: String(message.phoneNumberId ?? ""),
      body: message.body,
      raw: { provider: "meta", msg: message.msg },
    });

    let sendStatus: number | null = null;
    let sendOk = false;
    let sendError: string | null = null;

    if (token && message.phoneNumberId) {
      try {
        const graphResponse = await fetch(`https://graph.facebook.com/v21.0/${message.phoneNumberId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: message.from,
            text: { body: replyText },
          }),
        });
        sendStatus = graphResponse.status;
        sendOk = graphResponse.ok;
        if (!graphResponse.ok) {
          sendError = await graphResponse.text();
        }
      } catch {
        sendError = "graph request failed";
      }
    }

    await admin.from("whatsapp_messages").insert({
      tenant_id: tenantId,
      company_id: defaultCompanyId,
      direction: "outbound",
      from_number: String(message.phoneNumberId ?? ""),
      to_number: message.from,
      body: replyText,
      raw: {
        provider: "meta",
        graph_sent: Boolean(token && message.phoneNumberId),
        graph_ok: sendOk,
        graph_status: sendStatus,
        graph_error: sendError,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
