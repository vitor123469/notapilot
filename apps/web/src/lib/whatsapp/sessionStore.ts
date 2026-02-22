import "server-only";

import { getSupabaseAdmin } from "../supabase/admin";

type SessionInput = {
  tenantId: string;
  fromNumber: string;
};

type SetSessionInput = SessionInput & {
  companyId: string | null;
};

export async function getActiveCompanyId(input: SessionInput): Promise<string | null> {
  const tenantId = input.tenantId.trim();
  const fromNumber = input.fromNumber.trim();
  const fallbackCompanyId = process.env.TWILIO_DEFAULT_COMPANY_ID?.trim() || null;

  if (!tenantId || !fromNumber) {
    return fallbackCompanyId;
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("whatsapp_sessions")
    .select("active_company_id")
    .eq("tenant_id", tenantId)
    .eq("from_number", fromNumber)
    .maybeSingle<{ active_company_id: string | null }>();

  if (error) {
    throw new Error(error.message);
  }

  return data?.active_company_id ?? fallbackCompanyId;
}

export async function setActiveCompanyId(input: SetSessionInput): Promise<void> {
  const tenantId = input.tenantId.trim();
  const fromNumber = input.fromNumber.trim();
  const companyId = input.companyId?.trim() || null;

  if (!tenantId || !fromNumber) {
    return;
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("whatsapp_sessions").upsert(
    {
      tenant_id: tenantId,
      from_number: fromNumber,
      active_company_id: companyId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,from_number" }
  );

  if (error) {
    throw new Error(error.message);
  }
}
