import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { getSupabaseAdmin } from "../../../../src/lib/supabase/admin";

// ── Types ──────────────────────────────────────────────────────────────────

type DispatchRun = {
  id: string;
  ran_at: string;
  source: string;
  picked: number;
  sent: number;
  failed: number;
  retried: number;
  schedules_picked: number;
  jobs_created_from_schedules: number;
  duration_ms: number | null;
  error: string | null;
};

type ProblematicJob = {
  id: string;
  updated_at: string;
  status: string;
  attempts: number;
  template_key: string;
  to_phone: string;
  last_error: string | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  return `${ms} ms`;
}

const cellStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderBottom: "1px solid #e5e7eb",
  fontSize: 13,
  verticalAlign: "top",
  whiteSpace: "nowrap",
};

const headerStyle: React.CSSProperties = {
  ...cellStyle,
  background: "#f3f4f6",
  fontWeight: 600,
  textAlign: "left",
};

// ── Page ───────────────────────────────────────────────────────────────────

export default async function MonitorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();

  const token = process.env.ADMIN_MONITOR_TOKEN?.trim();
  const params = await searchParams;
  const provided = typeof params.token === "string" ? params.token.trim() : "";

  if (!token || provided !== token) {
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getSupabaseAdmin() as any;

  const [runsResult, jobsResult] = await Promise.all([
    admin
      .from("whatsapp_dispatch_runs")
      .select(
        "id, ran_at, source, picked, sent, failed, retried, schedules_picked, jobs_created_from_schedules, duration_ms, error"
      )
      .order("ran_at", { ascending: false })
      .limit(50),

    admin
      .from("whatsapp_jobs")
      .select("id, updated_at, status, attempts, template_key, to_phone, last_error")
      .or("attempts.gt.0,status.eq.failed")
      .order("updated_at", { ascending: false })
      .limit(30),
  ]);

  const runs: DispatchRun[] = runsResult.data ?? [];
  const jobs: ProblematicJob[] = jobsResult.data ?? [];

  const lastCronRun = runs.find((r) => r.source === "vercel_cron") ?? null;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 1100, padding: 24 }}>
      <h1 style={{ margin: "0 0 24px", fontSize: 22 }}>Monitoring</h1>

      {/* ── Cron health ─────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>Cron health</h2>
        <div
          style={{
            display: "inline-grid",
            gridTemplateColumns: "160px 1fr",
            gap: "6px 16px",
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "14px 18px",
            fontSize: 13,
          }}
        >
          <span style={{ color: "#6b7280" }}>Último run (vercel)</span>
          <span>{fmt(lastCronRun?.ran_at)}</span>
          <span style={{ color: "#6b7280" }}>Duração</span>
          <span>{fmtMs(lastCronRun?.duration_ms)}</span>
          <span style={{ color: "#6b7280" }}>Erro</span>
          <span style={{ color: lastCronRun?.error ? "crimson" : "#22c55e" }}>
            {lastCronRun?.error ?? "—"}
          </span>
        </div>
      </section>

      {/* ── Runs table ──────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>
          Últimos runs{" "}
          <span style={{ fontWeight: 400, color: "#6b7280", fontSize: 13 }}>({runs.length})</span>
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                {[
                  "ran_at",
                  "source",
                  "picked",
                  "sent",
                  "failed",
                  "retried",
                  "sched_picked",
                  "jobs_created",
                  "duration_ms",
                  "error",
                ].map((h) => (
                  <th key={h} style={headerStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} style={{ background: r.error ? "#fff5f5" : undefined }}>
                  <td style={cellStyle}>{fmt(r.ran_at)}</td>
                  <td style={cellStyle}>{r.source}</td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>{r.picked}</td>
                  <td style={{ ...cellStyle, textAlign: "right", color: "#16a34a" }}>{r.sent}</td>
                  <td style={{ ...cellStyle, textAlign: "right", color: r.failed ? "crimson" : undefined }}>{r.failed}</td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>{r.retried}</td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>{r.schedules_picked}</td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>{r.jobs_created_from_schedules}</td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>{fmtMs(r.duration_ms)}</td>
                  <td style={{ ...cellStyle, color: "crimson", maxWidth: 260, whiteSpace: "normal" }}>
                    {r.error ?? ""}
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ ...cellStyle, color: "#9ca3af", textAlign: "center" }}>
                    Nenhum run encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Problematic jobs ────────────────────────────────────────────── */}
      <section>
        <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>
          Jobs com problema{" "}
          <span style={{ fontWeight: 400, color: "#6b7280", fontSize: 13 }}>({jobs.length})</span>
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                {["updated_at", "status", "attempts", "template_key", "to_phone", "last_error"].map(
                  (h) => (
                    <th key={h} style={headerStyle}>
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} style={{ background: j.status === "failed" ? "#fff5f5" : undefined }}>
                  <td style={cellStyle}>{fmt(j.updated_at)}</td>
                  <td style={{ ...cellStyle, fontWeight: 600, color: j.status === "failed" ? "crimson" : "#d97706" }}>
                    {j.status}
                  </td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>{j.attempts}</td>
                  <td style={cellStyle}>{j.template_key}</td>
                  <td style={cellStyle}>{j.to_phone}</td>
                  <td style={{ ...cellStyle, maxWidth: 320, whiteSpace: "normal", color: "#dc2626" }}>
                    {j.last_error ?? "—"}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...cellStyle, color: "#9ca3af", textAlign: "center" }}>
                    Nenhum job com problema
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
