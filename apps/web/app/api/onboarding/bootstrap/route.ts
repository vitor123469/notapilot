import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../../../../src/lib/supabase/db.types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing Authorization Bearer token" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 500 });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return NextResponse.json({ error: "Invalid bearer token" }, { status: 401 });
  }

  const admin = createClient<Database>(supabaseUrl, serviceRoleKey);
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized token" }, { status: 401 });
  }

  const userId = user.id;
  const { data: existingMember, error: existingMemberError } = await admin
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (existingMemberError) {
    return NextResponse.json({ error: existingMemberError.message }, { status: 500 });
  }

  if (existingMember?.tenant_id) {
    return NextResponse.json({ tenantId: existingMember.tenant_id });
  }

  const { data: createdTenant, error: createTenantError } = await admin
    .from("tenants")
    .insert({
      name: "Minha empresa",
      created_by: userId,
    })
    .select("id")
    .single();

  if (createTenantError) {
    return NextResponse.json({ error: createTenantError.message }, { status: 500 });
  }

  const tenantId = createdTenant.id;
  const { error: createMemberError } = await admin.from("tenant_members").insert({
    tenant_id: tenantId,
    user_id: userId,
    role: "owner",
  });

  if (createMemberError) {
    return NextResponse.json({ error: createMemberError.message }, { status: 500 });
  }

  return NextResponse.json({ tenantId });
}
