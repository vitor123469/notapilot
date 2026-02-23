import { type NextRequest, NextResponse } from "next/server";

import { sendWhatsApp } from "../../../../src/lib/twilio/sendWhatsApp";
import { getSupabaseAdmin } from "../../../../src/lib/supabase/admin";

export const runtime = "nodejs";

const BATCH_SIZE = 50;
const LOCKER = "cron";

type WhatsAppJob = {
  id: string;
  tenant_id: string;
  status: string;
  run_at: string;
  attempts: number;
  max_attempts: number;
  dedupe_key: string | null;
  to_phone: string;
  template_key: string;
  payload: Record<string, unknown>;
  last_error: string | null;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
  updated_at: string;
};

function backoffMinutes(attempts: number): number {
  return Math.min(Math.pow(2, attempts), 60);
}

function addMinutes(date: Date, minutes: number): string {
  return new Date(date.getTime() + minutes * 60 * 1000).toISOString();
}

function buildMessageBody(job: WhatsAppJob): string {
  const payloadLines = Object.entries(job.payload)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(", ");
  return payloadLines
    ? `[${job.template_key}] ${payloadLines}`
    : `[${job.template_key}]`;
}

function authorize(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  // Primary: Vercel Cron sends "Authorization: Bearer <secret>"
  const authHeader = request.headers.get("authorization")?.trim();
  if (authHeader === `Bearer ${cronSecret}`) {
    return null;
  }

  // Fallback: legacy x-cron-secret header (local testing)
  const legacySecret = request.headers.get("x-cron-secret")?.trim();
  if (legacySecret === cronSecret) {
    return null;
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function handleDispatch(request: NextRequest): Promise<NextResponse> {
  const authError = authorize(request);
  if (authError) return authError;

  const admin = getSupabaseAdmin();

  // Atomically pick and lock pending jobs via FOR UPDATE SKIP LOCKED
  const { data: jobs, error: pickError } = await admin.rpc("pick_whatsapp_jobs", {
    batch_size: BATCH_SIZE,
    locker: LOCKER,
  });

  if (pickError) {
    console.error("[cron/whatsapp-dispatch] pick error:", pickError.message);
    return NextResponse.json({ error: "Failed to pick jobs", detail: pickError.message }, { status: 500 });
  }

  const pickedJobs = (jobs as WhatsAppJob[]) ?? [];
  console.log(`[cron/whatsapp-dispatch] picked ${pickedJobs.length} jobs`);

  let sent = 0;
  let failed = 0;
  let retried = 0;
  const now = new Date();

  for (const job of pickedJobs) {
    const messageBody = buildMessageBody(job);

    const result = await sendWhatsApp({ to: job.to_phone, body: messageBody });

    if (result.ok) {
      // ── success path ─────────────────────────────────────────────────────
      console.log(`[cron/whatsapp-dispatch] sent job=${job.id} sid=${result.sid}`);

      await admin
        .from("whatsapp_jobs")
        .update({ status: "sent", locked_by: null, updated_at: now.toISOString() })
        .eq("id", job.id);

      // Log to whatsapp_messages outbound
      await admin.from("whatsapp_messages").insert({
        tenant_id: job.tenant_id,
        direction: "outbound",
        from_number: process.env.TWILIO_FROM ?? null,
        to_number: job.to_phone,
        body: messageBody,
        raw: {
          source: "cron_dispatch",
          job_id: job.id,
          template_key: job.template_key,
          sid: result.sid,
        },
      });

      sent++;
    } else {
      // ── error path ────────────────────────────────────────────────────────
      const newAttempts = job.attempts + 1;
      const exhausted = newAttempts >= job.max_attempts;

      console.warn(
        `[cron/whatsapp-dispatch] error job=${job.id} attempt=${newAttempts}/${job.max_attempts} err=${result.error}`
      );

      if (exhausted) {
        await admin
          .from("whatsapp_jobs")
          .update({
            status: "failed",
            attempts: newAttempts,
            last_error: result.error,
            locked_by: null,
            updated_at: now.toISOString(),
          })
          .eq("id", job.id);
        failed++;
      } else {
        const runAt = addMinutes(now, backoffMinutes(newAttempts));
        await admin
          .from("whatsapp_jobs")
          .update({
            status: "pending",
            attempts: newAttempts,
            last_error: result.error,
            run_at: runAt,
            locked_at: null,
            locked_by: null,
            updated_at: now.toISOString(),
          })
          .eq("id", job.id);
        retried++;
      }
    }
  }

  console.log(
    `[cron/whatsapp-dispatch] done picked=${pickedJobs.length} sent=${sent} failed=${failed} retried=${retried}`
  );

  return NextResponse.json({
    picked: pickedJobs.length,
    sent,
    failed,
    retried,
  });
}

export async function GET(request: NextRequest) {
  return handleDispatch(request);
}

export async function POST(request: NextRequest) {
  return handleDispatch(request);
}
