import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "../../../src/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const admin = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("whatsapp_dispatch_runs")
    .select("ran_at, error, duration_ms")
    .eq("source", "vercel_cron")
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, reason: "db_error", env: process.env.VERCEL_ENV ?? "local" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      {
        ok: false,
        reason: "no_cron_runs",
        env: process.env.VERCEL_ENV ?? "local",
        now: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    env: process.env.VERCEL_ENV ?? "local",
    now: new Date().toISOString(),
    last_cron_run_at: data.ran_at,
    last_cron_error: data.error ?? null,
    last_cron_duration_ms: data.duration_ms ?? null,
  });
}
