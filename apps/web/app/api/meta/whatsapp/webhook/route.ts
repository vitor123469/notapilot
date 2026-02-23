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
        statuses?: Array<{
          id?: string;
          status?: string;
          recipient_id?: string;
          timestamp?: string;
          errors?: Array<{
            code?: number | string;
            title?: string;
            message?: string;
          }>;
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

function toIsoFromUnix(timestamp: string | undefined): string | null {
  if (!timestamp) {
    return null;
  }
  const unix = Number(timestamp);
  if (!Number.isFinite(unix)) {
    return null;
  }
  return new Date(unix * 1000).toISOString();
}

function getObject(value: Json | null): Record<string, Json | undefined> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json | undefined>;
  }
  return null;
}

function getGraphMessageId(raw: Json | null): string | null {
  const root = getObject(raw);
  const messages = root?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return null;
  }
  const first = messages[0];
  if (first && typeof first === "object" && !Array.isArray(first)) {
    const id = (first as Record<string, Json | undefined>).id;
    if (typeof id === "string" && id.trim()) {
      return id.trim();
    }
  }
  return null;
}

function getGraphError(raw: Json | null): { code: string | null; title: string | null; message: string | null } {
  const root = getObject(raw);
  const err = root?.error;
  if (!err || typeof err !== "object" || Array.isArray(err)) {
    return { code: null, title: null, message: null };
  }
  const errorObj = err as Record<string, Json | undefined>;
  const code = errorObj.code;
  const title = errorObj.error_subcode ?? errorObj.type;
  const message = errorObj.message;
  return {
    code: typeof code === "number" || typeof code === "string" ? String(code) : null,
    title: typeof title === "number" || typeof title === "string" ? String(title) : null,
    message: typeof message === "string" ? message : null,
  };
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
  const statusEvents: Array<{
    messageId: string | null;
    status: string;
    recipientId: string | null;
    timestamp: string | null;
    errorCode: string | null;
    errorTitle: string | null;
    errorMessage: string | null;
    raw: Json;
  }> = [];

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

      for (const statusItem of value.statuses ?? []) {
        const firstError = statusItem.errors?.[0];
        const status = String(statusItem.status ?? "").trim();
        if (!status) {
          continue;
        }
        statusEvents.push({
          messageId: String(statusItem.id ?? "").trim() || null,
          status,
          recipientId: String(statusItem.recipient_id ?? "").trim() || null,
          timestamp: toIsoFromUnix(statusItem.timestamp),
          errorCode:
            firstError && (typeof firstError.code === "number" || typeof firstError.code === "string")
              ? String(firstError.code)
              : null,
          errorTitle: firstError?.title?.trim() || null,
          errorMessage: firstError?.message?.trim() || null,
          raw: statusItem as Json,
        });
      }
    }
  }

  for (const event of statusEvents) {
    console.log(
      `[WA META] status=${event.status} id=${event.messageId ?? ""} recipient=${event.recipientId ?? ""} err=${event.errorCode ?? ""}`
    );
    await admin.from("whatsapp_delivery_events").insert({
      tenant_id: tenantId,
      provider: "meta",
      message_id: event.messageId,
      status: event.status,
      recipient_id: event.recipientId,
      timestamp: event.timestamp,
      error_code: event.errorCode,
      error_title: event.errorTitle,
      error_message: event.errorMessage,
      raw: event.raw,
    });
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
        const graphBodyText = await graphResponse.text();
        let graphBody: Json | null = null;
        if (graphBodyText) {
          try {
            graphBody = JSON.parse(graphBodyText) as Json;
          } catch {
            graphBody = { text: graphBodyText };
          }
        }

        const graphMessageId = getGraphMessageId(graphBody);
        if (sendOk) {
          console.log(`[WA META] send_ok id=${graphMessageId ?? ""}`);
          await admin.from("whatsapp_delivery_events").insert({
            tenant_id: tenantId,
            provider: "meta",
            message_id: graphMessageId,
            status: "sent",
            recipient_id: message.from,
            timestamp: new Date().toISOString(),
            error_code: null,
            error_title: null,
            error_message: null,
            raw: graphBody ?? { ok: true },
          });
        } else {
          const graphErr = getGraphError(graphBody);
          sendError = graphBodyText || "graph request failed";
          await admin.from("whatsapp_delivery_events").insert({
            tenant_id: tenantId,
            provider: "meta",
            message_id: graphMessageId,
            status: "failed",
            recipient_id: message.from,
            timestamp: new Date().toISOString(),
            error_code: graphErr.code,
            error_title: graphErr.title,
            error_message: graphErr.message ?? sendError,
            raw: graphBody ?? { error: sendError },
          });
        }
      } catch {
        sendError = "graph request failed";
        await admin.from("whatsapp_delivery_events").insert({
          tenant_id: tenantId,
          provider: "meta",
          message_id: null,
          status: "failed",
          recipient_id: message.from,
          timestamp: new Date().toISOString(),
          error_code: null,
          error_title: "graph_request",
          error_message: sendError,
          raw: { error: sendError },
        });
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
