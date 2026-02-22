create table if not exists public.whatsapp_sessions (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  from_number text not null,
  active_company_id uuid,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, from_number)
);

alter table public.whatsapp_sessions
  add constraint whatsapp_sessions_company_fk
  foreign key (tenant_id, active_company_id)
  references public.companies (tenant_id, id)
  on delete set null;

create index if not exists whatsapp_sessions_tenant_active_company_idx
  on public.whatsapp_sessions (tenant_id, active_company_id);

drop trigger if exists whatsapp_sessions_set_updated_at on public.whatsapp_sessions;
create trigger whatsapp_sessions_set_updated_at
before update on public.whatsapp_sessions
for each row execute function public.set_updated_at();
