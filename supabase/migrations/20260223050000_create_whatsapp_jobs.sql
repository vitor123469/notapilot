-- ============================================================
-- WhatsApp autopilot job queue
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists public.whatsapp_jobs (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      uuid        not null references public.tenants(id) on delete cascade,
  status         text        not null default 'pending'
                               check (status in ('pending','processing','sent','failed','canceled')),
  run_at         timestamptz not null,
  attempts       int         not null default 0,
  max_attempts   int         not null default 5,
  dedupe_key     text,
  to_phone       text        not null,
  template_key   text        not null,
  payload        jsonb       not null default '{}'::jsonb,
  last_error     text,
  locked_at      timestamptz,
  locked_by      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- composite index for queue worker queries
create index if not exists whatsapp_jobs_tenant_status_run_at_idx
  on public.whatsapp_jobs (tenant_id, status, run_at);

-- partial unique index for deduplication
create unique index if not exists whatsapp_jobs_tenant_dedupe_key_udx
  on public.whatsapp_jobs (tenant_id, dedupe_key)
  where dedupe_key is not null;

-- keep updated_at in sync automatically
drop trigger if exists whatsapp_jobs_set_updated_at on public.whatsapp_jobs;
create trigger whatsapp_jobs_set_updated_at
before update on public.whatsapp_jobs
for each row execute function public.set_updated_at();

-- ============================================================
-- Row-Level Security
-- ============================================================

alter table public.whatsapp_jobs enable row level security;

-- authenticated users may only read jobs that belong to tenants
-- they are members of; INSERT / UPDATE / DELETE stay server-side
-- (service role bypasses RLS).
drop policy if exists whatsapp_jobs_select_tenant_member on public.whatsapp_jobs;
create policy whatsapp_jobs_select_tenant_member
on public.whatsapp_jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = whatsapp_jobs.tenant_id
      and tm.user_id   = auth.uid()
  )
);
