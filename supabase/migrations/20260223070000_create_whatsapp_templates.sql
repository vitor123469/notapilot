-- ============================================================
-- WhatsApp message templates
-- ============================================================

create table if not exists public.whatsapp_templates (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  uuid        not null references public.tenants(id) on delete cascade,
  key        text        not null,
  body       text        not null,
  enabled    boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists whatsapp_templates_tenant_key_udx
  on public.whatsapp_templates (tenant_id, key);

drop trigger if exists whatsapp_templates_set_updated_at on public.whatsapp_templates;
create trigger whatsapp_templates_set_updated_at
before update on public.whatsapp_templates
for each row execute function public.set_updated_at();

-- ============================================================
-- Row-Level Security
-- ============================================================

alter table public.whatsapp_templates enable row level security;

drop policy if exists whatsapp_templates_select_tenant_member on public.whatsapp_templates;
create policy whatsapp_templates_select_tenant_member
on public.whatsapp_templates
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = whatsapp_templates.tenant_id
      and tm.user_id   = auth.uid()
  )
);
