-- ============================================================
-- WhatsApp recurring schedule definitions
-- ============================================================

create table if not exists public.whatsapp_schedules (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        uuid        not null references public.tenants(id) on delete cascade,
  schedule_key     text        not null,
  template_key     text        not null,
  enabled          boolean     not null default true,
  next_run_at      timestamptz not null,
  interval_seconds int         not null default 86400,
  payload          jsonb       not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- worker query: pick enabled schedules due to run
create index if not exists whatsapp_schedules_tenant_enabled_next_run_idx
  on public.whatsapp_schedules (tenant_id, enabled, next_run_at);

-- one schedule_key per tenant
create unique index if not exists whatsapp_schedules_tenant_schedule_key_udx
  on public.whatsapp_schedules (tenant_id, schedule_key);

drop trigger if exists whatsapp_schedules_set_updated_at on public.whatsapp_schedules;
create trigger whatsapp_schedules_set_updated_at
before update on public.whatsapp_schedules
for each row execute function public.set_updated_at();

-- ============================================================
-- Row-Level Security
-- ============================================================

alter table public.whatsapp_schedules enable row level security;

drop policy if exists whatsapp_schedules_select_tenant_member on public.whatsapp_schedules;
create policy whatsapp_schedules_select_tenant_member
on public.whatsapp_schedules
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = whatsapp_schedules.tenant_id
      and tm.user_id   = auth.uid()
  )
);
