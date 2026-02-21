import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "../../../../src/lib/supabase/admin";

export const runtime = "nodejs";

type DeleteCompanyBody = {
  tenantId?: string;
  companyId?: string;
  force?: boolean;
};

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing Authorization Bearer token" }, { status: 401 });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return NextResponse.json({ error: "Invalid bearer token" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized token" }, { status: 401 });
  }

  let body: DeleteCompanyBody;
  try {
    body = (await request.json()) as DeleteCompanyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const tenantId = body.tenantId?.trim();
  const companyId = body.companyId?.trim();
  const force = Boolean(body.force);

  if (!tenantId || !companyId) {
    return NextResponse.json({ error: "tenantId e companyId são obrigatórios." }, { status: 400 });
  }

  const { data: membership, error: membershipError } = await admin
    .from("tenant_members")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }
  if (!membership) {
    return NextResponse.json({ error: "Forbidden tenant access" }, { status: 403 });
  }

  const { data: company, error: companyError } = await admin
    .from("companies")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", companyId)
    .maybeSingle();

  if (companyError) {
    return NextResponse.json({ error: companyError.message }, { status: 500 });
  }
  if (!company) {
    return NextResponse.json({ error: "Company not found for tenant" }, { status: 404 });
  }

  if (force) {
    const { data: nfses, error: nfsesFetchError } = await admin
      .from("nfses")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("company_id", companyId);

    if (nfsesFetchError) {
      return NextResponse.json({ error: nfsesFetchError.message }, { status: 500 });
    }

    const nfseIds = (nfses ?? []).map((item) => item.id);
    if (nfseIds.length > 0) {
      const { error: eventsDeleteError } = await admin
        .from("nfse_events")
        .delete()
        .eq("tenant_id", tenantId)
        .in("nfse_id", nfseIds);

      if (eventsDeleteError) {
        return NextResponse.json({ error: eventsDeleteError.message }, { status: 500 });
      }

      const { error: nfsesDeleteError } = await admin
        .from("nfses")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("company_id", companyId);

      if (nfsesDeleteError) {
        return NextResponse.json({ error: nfsesDeleteError.message }, { status: 500 });
      }
    }
  }

  const { error: companyDeleteError } = await admin.from("companies").delete().eq("tenant_id", tenantId).eq("id", companyId);
  if (companyDeleteError) {
    return NextResponse.json({ error: companyDeleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
