import { type NextRequest, NextResponse } from "next/server";

import type { Json } from "../../../../src/lib/supabase/db.types";
import { sendWhatsApp } from "../../../../src/lib/twilio/sendWhatsApp";
import { getSupabaseAdmin } from "../../../../src/lib/supabase/admin";

export const runtime = "nodejs";

const BATCH_SIZE = 50;
const LOCKER = "cron";

type DueSchedule = {
  id: string;
  tenant_id: string;
  schedule_key: string;
  template_key: string;
  enabled: boolean;
  due_next_run_at: string;
  next_run_at: string;
  interval_seconds: number;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

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

// ---------------------------------------------------------------------------
// Template rendering
// ---------------------------------------------------------------------------

function resolveNestedValue(payload: Record<string, unknown>, path: string): string {
  const parts = path.split(".");
  let cursor: unknown = payload;
  for (const part of parts) {
    if (cursor === null || typeof cursor !== "object" || Array.isArray(cursor)) {
      return "";
    }
    cursor = (cursor as Record<string, unknown>)[part];
  }
  if (cursor === null || cursor === undefined) return "";
  if (typeof cursor === "string" || typeof cursor === "number" || typeof cursor === "boolean") {
    return String(cursor);
  }
  return "";
}

function renderTemplate(body: string, payload: Record<string, unknown>): string {
  return body.replace(/\{\{([^}]+)\}\}/g, (_, key: string) =>
    resolveNestedValue(payload, key.trim())
  );
}

type TemplateRow = { body: string };

async function resolveMessageBody(
  admin: ReturnType<typeof getSupabaseAdmin>,
  job: WhatsAppJob
): Promise<string> {
  // Compat path: job.payload.text overrides template lookup
  const payloadText = job.payload.text;
  if (typeof payloadText === "string" && payloadText.trim()) {
    return payloadText.trim();
  }

  const { data: template, error } = await admin
    .from("whatsapp_templates")
    .select("body")
    .eq("tenant_id", job.tenant_id)
    .eq("key", job.template_key)
    .eq("enabled", true)
    .maybeSingle<TemplateRow>();

  if (error) {
    throw new Error(`TEMPLATE_LOOKUP_ERROR:${job.template_key}`);
  }
  if (!template) {
    throw new Error(`TEMPLATE_NOT_FOUND:${job.template_key}`);
  }

  return renderTemplate(template.body, job.payload);
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

type SpawnResult = { schedulesPicked: number; jobsCreated: number };

async function spawnJobsFromSchedules(
  admin: ReturnType<typeof getSupabaseAdmin>,
  now: Date
): Promise<SpawnResult> {
  const { data: schedules, error: scheduleError } = await admin.rpc(
    "pick_due_whatsapp_schedules",
    { batch_size: BATCH_SIZE }
  );

  if (scheduleError) {
    console.error("[cron/whatsapp-dispatch] schedule pick error:", scheduleError.message);
    return { schedulesPicked: 0, jobsCreated: 0 };
  }

  const dueSchedules = (schedules as DueSchedule[]) ?? [];
  if (!dueSchedules.length) return { schedulesPicked: 0, jobsCreated: 0 };

  console.log(`[cron/whatsapp-dispatch] spawning jobs for ${dueSchedules.length} due schedule(s)`);

  let jobsCreated = 0;
  for (const schedule of dueSchedules) {
    const rawPayload = schedule.payload;

    // Resolve to_phone from payload.to_phone or payload.to
    const toPhone =
      typeof rawPayload.to_phone === "string" && rawPayload.to_phone.trim()
        ? rawPayload.to_phone.trim()
        : typeof rawPayload.to === "string" && rawPayload.to.trim()
          ? (rawPayload.to as string).trim()
          : null;

    if (!toPhone) {
      console.warn(
        `[cron/whatsapp-dispatch] schedule ${schedule.id} (${schedule.schedule_key}) skipped: no to_phone in payload`
      );
      continue;
    }

    const dedupeKey = `schedule:${schedule.id}:${schedule.due_next_run_at}`;

    const { error: insertError } = await admin.from("whatsapp_jobs").insert({
      tenant_id: schedule.tenant_id,
      run_at: now.toISOString(),
      template_key: schedule.template_key,
      payload: rawPayload as Json,
      to_phone: toPhone,
      dedupe_key: dedupeKey,
    });

    if (insertError) {
      // Unique-key violation means job already exists for this schedule tick — safe to ignore
      if (insertError.code === "23505") {
        console.log(`[cron/whatsapp-dispatch] dedupe skip schedule=${schedule.id} key=${dedupeKey}`);
      } else {
        console.error(
          `[cron/whatsapp-dispatch] failed to spawn job for schedule=${schedule.id}: ${insertError.message}`
        );
      }
    } else {
      jobsCreated++;
    }
  }

  return { schedulesPicked: dueSchedules.length, jobsCreated };
}

// ---------------------------------------------------------------------------
// Source detection & run recording
// ---------------------------------------------------------------------------

function detectSource(request: NextRequest): string {
  if (request.headers.has("x-vercel-cron")) return "vercel_cron";
  const ua = request.headers.get("user-agent") ?? "";
  if (/vercel/i.test(ua)) return "vercel_cron";
  return "manual";
}

interface RunRecord {
  source: string;
  picked: number;
  sent: number;
  failed: number;
  retried: number;
  schedulesPicked: number;
  jobsCreatedFromSchedules: number;
  durationMs: number;
  error?: string;
}

async function recordRun(
  admin: ReturnType<typeof getSupabaseAdmin>,
  run: RunRecord
): Promise<void> {
  const row = {
    source:                      run.source                    ?? "unknown",
    picked:                      run.picked                    ?? 0,
    sent:                        run.sent                      ?? 0,
    failed:                      run.failed                    ?? 0,
    retried:                     run.retried                   ?? 0,
    schedules_picked:            run.schedulesPicked           ?? 0,
    jobs_created_from_schedules: run.jobsCreatedFromSchedules  ?? 0,
    duration_ms:                 run.durationMs                ?? null,
    error:                       run.error                     ?? null,
    meta:                        { env: process.env.VERCEL_ENV ?? "local" },
  };

  const { error } = await admin.from("whatsapp_dispatch_runs").insert(row);
  if (error) {
    console.error("[cron/whatsapp-dispatch] recordRun failed:", error);
  }
}

async function handleDispatch(request: NextRequest): Promise<NextResponse> {
  const authError = authorize(request);
  if (authError) return authError;

  const start = Date.now();
  const source = detectSource(request);
  const admin = getSupabaseAdmin();
  const now = new Date();

  let schedulesPicked = 0;
  let jobsCreatedFromSchedules = 0;
  let picked = 0;
  let sent = 0;
  let failed = 0;
  let retried = 0;

  try {
    // ── Step 1: spawn jobs from due schedules ────────────────────────────────
    const spawnResult = await spawnJobsFromSchedules(admin, now);
    schedulesPicked = spawnResult.schedulesPicked;
    jobsCreatedFromSchedules = spawnResult.jobsCreated;
    if (jobsCreatedFromSchedules > 0) {
      console.log(`[cron/whatsapp-dispatch] spawned ${jobsCreatedFromSchedules} job(s) from ${schedulesPicked} schedule(s)`);
    }

    // ── Step 2: atomically pick and lock pending jobs via FOR UPDATE SKIP LOCKED
    const { data: jobs, error: pickError } = await admin.rpc("pick_whatsapp_jobs", {
      batch_size: BATCH_SIZE,
      locker: LOCKER,
    });

    if (pickError) {
      console.error("[cron/whatsapp-dispatch] pick error:", pickError.message);
      await recordRun(admin, { source, picked, sent, failed, retried, schedulesPicked, jobsCreatedFromSchedules, durationMs: Date.now() - start, error: pickError.message });
      return NextResponse.json({ error: "Failed to pick jobs", detail: pickError.message }, { status: 500 });
    }

    const pickedJobs = (jobs as WhatsAppJob[]) ?? [];
    picked = pickedJobs.length;
    console.log(`[cron/whatsapp-dispatch] picked ${picked} jobs`);

    for (const job of pickedJobs) {
      // Resolve message body (template lookup or payload.text compat)
      let messageBody: string;
      try {
        messageBody = await resolveMessageBody(admin, job);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "TEMPLATE_RESOLVE_ERROR";
        console.warn(`[cron/whatsapp-dispatch] template error job=${job.id} err=${errMsg}`);
        const newAttempts = job.attempts + 1;
        const exhausted = newAttempts >= job.max_attempts;
        if (exhausted) {
          await admin
            .from("whatsapp_jobs")
            .update({ status: "failed", attempts: newAttempts, last_error: errMsg, locked_by: null, updated_at: now.toISOString() })
            .eq("id", job.id);
          failed++;
        } else {
          await admin
            .from("whatsapp_jobs")
            .update({ status: "pending", attempts: newAttempts, last_error: errMsg, run_at: addMinutes(now, backoffMinutes(newAttempts)), locked_at: null, locked_by: null, updated_at: now.toISOString() })
            .eq("id", job.id);
          retried++;
        }
        continue;
      }

      const result = await sendWhatsApp({ to: job.to_phone, body: messageBody });

      if (result.ok) {
        // ── success path ───────────────────────────────────────────────────
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
        // ── error path ─────────────────────────────────────────────────────
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
      `[cron/whatsapp-dispatch] done picked=${picked} sent=${sent} failed=${failed} retried=${retried}`
    );

    await recordRun(admin, { source, picked, sent, failed, retried, schedulesPicked, jobsCreatedFromSchedules, durationMs: Date.now() - start });

    return NextResponse.json({ picked, sent, failed, retried });

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "UNKNOWN_ERROR";
    console.error("[cron/whatsapp-dispatch] unhandled error:", errMsg);
    await recordRun(admin, { source, picked, sent, failed, retried, schedulesPicked, jobsCreatedFromSchedules, durationMs: Date.now() - start, error: errMsg });
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleDispatch(request);
}

export async function POST(request: NextRequest) {
  return handleDispatch(request);
}
