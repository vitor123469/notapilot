import { notFound } from "next/navigation";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";

import { getSupabaseAdmin } from "../../../src/lib/supabase/admin";

// ── Types ──────────────────────────────────────────────────────────────────

type Tenant = { id: string; name: string; created_at: string };

type Company = {
  id: string;
  tenant_id: string;
  legal_name: string;
  trade_name: string | null;
  cnpj: string;
  whatsapp_phone: string | null;
};

type Schedule = {
  id: string;
  tenant_id: string;
  schedule_key: string;
  template_key: string;
  enabled: boolean;
  next_run_at: string;
  interval_seconds: number;
  updated_at: string;
};

type Template = {
  id: string;
  key: string;
  enabled: boolean;
  body: string;
  updated_at: string;
};

// ── Token guard (used inside server actions) ───────────────────────────────

function validToken(token: unknown): boolean {
  const configured = process.env.ADMIN_CONFIG_TOKEN?.trim();
  return Boolean(configured && typeof token === "string" && token === configured);
}

// ── Server Actions ─────────────────────────────────────────────────────────

async function updateCompanyPhone(formData: FormData) {
  "use server";
  if (!validToken(formData.get("token"))) return;

  const tenantId = formData.get("tenant_id") as string;
  const companyId = formData.get("company_id") as string;
  const raw = ((formData.get("whatsapp_phone") as string) ?? "").trim();
  const phone = raw === "" ? null : raw;

  if (phone !== null && !/^whatsapp:\+\d{8,15}$/.test(phone)) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getSupabaseAdmin() as any;
  await admin
    .from("companies")
    .update({ whatsapp_phone: phone })
    .eq("id", companyId)
    .eq("tenant_id", tenantId);

  revalidatePath("/admin/config");
}

async function toggleScheduleEnabled(formData: FormData) {
  "use server";
  if (!validToken(formData.get("token"))) return;

  const tenantId = formData.get("tenant_id") as string;
  const scheduleId = formData.get("schedule_id") as string;
  const current = formData.get("enabled") === "true";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getSupabaseAdmin() as any;
  await admin
    .from("whatsapp_schedules")
    .update({ enabled: !current })
    .eq("id", scheduleId)
    .eq("tenant_id", tenantId);

  revalidatePath("/admin/config");
}

async function scheduleRunNow(formData: FormData) {
  "use server";
  if (!validToken(formData.get("token"))) return;

  const tenantId = formData.get("tenant_id") as string;
  const scheduleId = formData.get("schedule_id") as string;
  const pastMinute = new Date(Date.now() - 60_000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getSupabaseAdmin() as any;
  await admin
    .from("whatsapp_schedules")
    .update({ next_run_at: pastMinute })
    .eq("id", scheduleId)
    .eq("tenant_id", tenantId);

  revalidatePath("/admin/config");
}

async function updateScheduleInterval(formData: FormData) {
  "use server";
  if (!validToken(formData.get("token"))) return;

  const tenantId = formData.get("tenant_id") as string;
  const scheduleId = formData.get("schedule_id") as string;
  const seconds = Number(formData.get("interval_seconds"));

  if (!Number.isInteger(seconds) || seconds < 60) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getSupabaseAdmin() as any;
  await admin
    .from("whatsapp_schedules")
    .update({ interval_seconds: seconds })
    .eq("id", scheduleId)
    .eq("tenant_id", tenantId);

  revalidatePath("/admin/config");
}

// ── Style helpers ──────────────────────────────────────────────────────────

const cell: React.CSSProperties = {
  padding: "6px 10px",
  borderBottom: "1px solid #e5e7eb",
  fontSize: 13,
  verticalAlign: "middle",
};

const th: React.CSSProperties = {
  ...cell,
  background: "#f3f4f6",
  fontWeight: 600,
  textAlign: "left",
};

function btn(bg: string): React.CSSProperties {
  return {
    padding: "3px 10px",
    fontSize: 12,
    cursor: "pointer",
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: 4,
    marginRight: 3,
  };
}

function fmt(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function ConfigPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();

  const configToken = process.env.ADMIN_CONFIG_TOKEN?.trim();
  const params = await searchParams;
  const provided = typeof params.token === "string" ? params.token.trim() : "";

  if (!configToken || provided !== configToken) {
    notFound();
  }

  const tenantId = typeof params.tenant === "string" ? params.tenant.trim() : "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getSupabaseAdmin() as any;

  // ── A) Tenant list ────────────────────────────────────────────────────────

  if (!tenantId) {
    const { data } = await admin
      .from("tenants")
      .select("id, name, created_at")
      .order("created_at", { ascending: false })
      .limit(25);

    const tenants: Tenant[] = data ?? [];

    return (
      <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 900, padding: 24 }}>
        <h1 style={{ fontSize: 20, margin: "0 0 20px" }}>Config — selecione um tenant</h1>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Tenant ID", "Nome", "Criado em", ""].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id}>
                <td style={{ ...cell, fontFamily: "monospace", fontSize: 12 }}>{t.id}</td>
                <td style={cell}>{t.name}</td>
                <td style={cell}>{fmt(t.created_at)}</td>
                <td style={cell}>
                  <a
                    href={`/admin/config?token=${encodeURIComponent(provided)}&tenant=${encodeURIComponent(t.id)}`}
                    style={{ fontSize: 12, color: "#2563eb" }}
                  >
                    Selecionar →
                  </a>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={4} style={{ ...cell, color: "#9ca3af", textAlign: "center" }}>
                  Nenhum tenant encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // ── B) Tenant-specific view ───────────────────────────────────────────────

  const [companiesRes, schedulesRes, templatesRes] = await Promise.all([
    admin
      .from("companies")
      .select("id, tenant_id, legal_name, trade_name, cnpj, whatsapp_phone")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50),

    admin
      .from("whatsapp_schedules")
      .select("id, tenant_id, schedule_key, template_key, enabled, next_run_at, interval_seconds, updated_at")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(100),

    admin
      .from("whatsapp_templates")
      .select("id, key, enabled, body, updated_at")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  const companies: Company[] = companiesRes.data ?? [];
  const schedules: Schedule[] = schedulesRes.data ?? [];
  const templates: Template[] = templatesRes.data ?? [];
  const backUrl = `/admin/config?token=${encodeURIComponent(provided)}`;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 1100, padding: 24 }}>
      {/* header */}
      <div style={{ marginBottom: 24 }}>
        <a href={backUrl} style={{ fontSize: 13, color: "#6b7280" }}>← Todos os tenants</a>
        <h1 style={{ fontSize: 20, margin: "6px 0 2px" }}>Config</h1>
        <code style={{ fontSize: 12, color: "#6b7280" }}>{tenantId}</code>
      </div>

      {/* ── Companies ──────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 44 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>
          Empresas <span style={{ fontWeight: 400, color: "#6b7280", fontSize: 13 }}>({companies.length})</span>
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {["trade_name / legal_name", "cnpj", "whatsapp_phone atual", "Atualizar phone"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td style={cell}>
                    <div style={{ fontWeight: 500 }}>{c.trade_name ?? "—"}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{c.legal_name}</div>
                  </td>
                  <td style={{ ...cell, fontFamily: "monospace", fontSize: 12 }}>{c.cnpj}</td>
                  <td style={{ ...cell, fontFamily: "monospace", fontSize: 12, color: c.whatsapp_phone ? "#374151" : "#9ca3af" }}>
                    {c.whatsapp_phone ?? "null"}
                  </td>
                  <td style={cell}>
                    <form action={updateCompanyPhone} style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                      <input type="hidden" name="token" value={provided} />
                      <input type="hidden" name="tenant_id" value={tenantId} />
                      <input type="hidden" name="company_id" value={c.id} />
                      <input
                        name="whatsapp_phone"
                        defaultValue={c.whatsapp_phone ?? ""}
                        placeholder="whatsapp:+5521..."
                        style={{ width: 190, fontSize: 12, padding: "3px 6px", border: "1px solid #d1d5db", borderRadius: 4 }}
                      />
                      <button type="submit" style={btn("#2563eb")}>Salvar</button>
                    </form>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>
                      vazio = NULL · formato: whatsapp:+DDDnúmero
                    </div>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ ...cell, color: "#9ca3af", textAlign: "center" }}>
                    Nenhuma empresa
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Schedules ──────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 44 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>
          Schedules <span style={{ fontWeight: 400, color: "#6b7280", fontSize: 13 }}>({schedules.length})</span>
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {["schedule_key", "template_key", "enabled", "next_run_at", "interval (s)", "Ações"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td style={cell}>{s.schedule_key}</td>
                  <td style={cell}>{s.template_key}</td>
                  <td style={cell}>
                    <span style={{ fontWeight: 600, color: s.enabled ? "#16a34a" : "#dc2626" }}>
                      {s.enabled ? "✓ ativo" : "✗ inativo"}
                    </span>
                  </td>
                  <td style={{ ...cell, fontSize: 12 }}>{fmt(s.next_run_at)}</td>
                  <td style={cell}>
                    <form action={updateScheduleInterval} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <input type="hidden" name="token" value={provided} />
                      <input type="hidden" name="tenant_id" value={tenantId} />
                      <input type="hidden" name="schedule_id" value={s.id} />
                      <input
                        name="interval_seconds"
                        type="number"
                        defaultValue={s.interval_seconds}
                        min={60}
                        style={{ width: 80, fontSize: 12, padding: "3px 6px", border: "1px solid #d1d5db", borderRadius: 4 }}
                      />
                      <button type="submit" style={btn("#6b7280")}>Salvar</button>
                    </form>
                  </td>
                  <td style={{ ...cell, whiteSpace: "nowrap" }}>
                    <form action={toggleScheduleEnabled} style={{ display: "inline" }}>
                      <input type="hidden" name="token" value={provided} />
                      <input type="hidden" name="tenant_id" value={tenantId} />
                      <input type="hidden" name="schedule_id" value={s.id} />
                      <input type="hidden" name="enabled" value={String(s.enabled)} />
                      <button type="submit" style={btn(s.enabled ? "#dc2626" : "#16a34a")}>
                        {s.enabled ? "Desativar" : "Ativar"}
                      </button>
                    </form>
                    <form action={scheduleRunNow} style={{ display: "inline" }}>
                      <input type="hidden" name="token" value={provided} />
                      <input type="hidden" name="tenant_id" value={tenantId} />
                      <input type="hidden" name="schedule_id" value={s.id} />
                      <button type="submit" style={btn("#d97706")}>Run now</button>
                    </form>
                  </td>
                </tr>
              ))}
              {schedules.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...cell, color: "#9ca3af", textAlign: "center" }}>
                    Nenhum schedule
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Templates (read-only) ──────────────────────────────────────── */}
      <section>
        <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>
          Templates{" "}
          <span style={{ fontWeight: 400, color: "#6b7280", fontSize: 13 }}>
            ({templates.length}) — somente leitura
          </span>
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {["key", "enabled", "atualizado em", "preview"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td style={cell}>{t.key}</td>
                  <td style={cell}>
                    <span style={{ fontWeight: 600, color: t.enabled ? "#16a34a" : "#dc2626" }}>
                      {t.enabled ? "✓" : "✗"}
                    </span>
                  </td>
                  <td style={{ ...cell, fontSize: 12 }}>{fmt(t.updated_at)}</td>
                  <td style={{ ...cell, maxWidth: 420, color: "#374151", fontStyle: "italic", fontSize: 12 }}>
                    {t.body.slice(0, 80)}{t.body.length > 80 ? "…" : ""}
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ ...cell, color: "#9ca3af", textAlign: "center" }}>
                    Nenhum template
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
