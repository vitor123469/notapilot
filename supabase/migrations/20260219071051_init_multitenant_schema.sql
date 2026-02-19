-- =========================================
-- NotaPilot - Init multi-tenant schema + RLS
-- =========================================

-- Extensions (for gen_random_uuid)
create extension if not exists "pgcrypto";

-- -----------------------------
-- Helpers
-- -----------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------
-- Profiles (1:1 with auth.users)
-- -----------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Auto-create profile on signup (safe + idempotent)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- -----------------------------
-- Tenancy
-- -----------------------------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict
);

create index if not exists tenants_created_by_idx on public.tenants(created_by);

drop trigger if exists tenants_set_updated_at on public.tenants;
create trigger tenants_set_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

create table if not exists public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner','admin','member','accountant','viewer')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index if not exists tenant_members_user_id_idx on public.tenant_members(user_id);
create index if not exists tenant_members_tenant_id_idx on public.tenant_members(tenant_id);

-- Membership helpers (SECURITY DEFINER avoids RLS recursion)
create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = auth.uid()
  );
$$;

create or replace function public.is_tenant_admin(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = auth.uid()
      and tm.role in ('owner','admin')
  );
$$;

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;

-- Tenants policies
drop policy if exists tenants_select_member on public.tenants;
create policy tenants_select_member
on public.tenants for select
to authenticated
using (public.is_tenant_member(id));

drop policy if exists tenants_insert_creator on public.tenants;
create policy tenants_insert_creator
on public.tenants for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists tenants_update_admin on public.tenants;
create policy tenants_update_admin
on public.tenants for update
to authenticated
using (public.is_tenant_admin(id))
with check (public.is_tenant_admin(id));

drop policy if exists tenants_delete_admin on public.tenants;
create policy tenants_delete_admin
on public.tenants for delete
to authenticated
using (public.is_tenant_admin(id));

-- Tenant members policies
drop policy if exists tenant_members_select_member on public.tenant_members;
create policy tenant_members_select_member
on public.tenant_members for select
to authenticated
using (public.is_tenant_member(tenant_id));

-- Bootstrap: creator can add themselves as owner for their own tenant
drop policy if exists tenant_members_insert_bootstrap_owner on public.tenant_members;
create policy tenant_members_insert_bootstrap_owner
on public.tenant_members for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'owner'
  and exists (
    select 1 from public.tenants t
    where t.id = tenant_id
      and t.created_by = auth.uid()
  )
);

-- Admins can add members (including accountants/viewers)
drop policy if exists tenant_members_insert_by_admin on public.tenant_members;
create policy tenant_members_insert_by_admin
on public.tenant_members for insert
to authenticated
with check (public.is_tenant_admin(tenant_id));

drop policy if exists tenant_members_update_by_admin on public.tenant_members;
create policy tenant_members_update_by_admin
on public.tenant_members for update
to authenticated
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

drop policy if exists tenant_members_delete_by_admin on public.tenant_members;
create policy tenant_members_delete_by_admin
on public.tenant_members for delete
to authenticated
using (public.is_tenant_admin(tenant_id));

-- -----------------------------
-- Core entities
-- -----------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legal_name text not null,
  trade_name text,
  cnpj text not null,
  municipal_registration text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_tenant_id_unique unique (tenant_id, id)
);

create unique index if not exists companies_tenant_cnpj_uq on public.companies(tenant_id, cnpj);
create index if not exists companies_tenant_idx on public.companies(tenant_id);

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

alter table public.companies enable row level security;

drop policy if exists companies_select_member on public.companies;
create policy companies_select_member
on public.companies for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists companies_insert_member on public.companies;
create policy companies_insert_member
on public.companies for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

drop policy if exists companies_update_member on public.companies;
create policy companies_update_member
on public.companies for update
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

drop policy if exists companies_delete_admin on public.companies;
create policy companies_delete_admin
on public.companies for delete
to authenticated
using (public.is_tenant_admin(tenant_id));

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  cpf_cnpj text,
  email text,
  phone text,
  address jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_tenant_id_unique unique (tenant_id, id)
);

create index if not exists clients_tenant_idx on public.clients(tenant_id);

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

alter table public.clients enable row level security;

drop policy if exists clients_select_member on public.clients;
create policy clients_select_member
on public.clients for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists clients_insert_member on public.clients;
create policy clients_insert_member
on public.clients for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

drop policy if exists clients_update_member on public.clients;
create policy clients_update_member
on public.clients for update
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

drop policy if exists clients_delete_admin on public.clients;
create policy clients_delete_admin
on public.clients for delete
to authenticated
using (public.is_tenant_admin(tenant_id));

-- -----------------------------
-- NFS-e (simplified core)
-- -----------------------------
create table if not exists public.nfses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  company_id uuid not null,
  client_id uuid,

  idempotency_key text not null,
  provider text not null default 'nfse_nacional',
  status text not null default 'draft'
    check (status in (
      'draft','submitted','authorized','rejected',
      'cancel_requested','cancelled',
      'substitute_requested','substituted'
    )),

  service_description text,
  service_value numeric(14,2) not null default 0,

  issued_at timestamptz,
  competence_date date,

  provider_request_id text,
  provider_nfse_number text,

  raw_request jsonb,
  raw_response jsonb,

  error_code text,
  error_message text,

  pdf_url text,
  xml_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint nfses_tenant_id_unique unique (tenant_id, id),
  constraint nfses_company_fk foreign key (tenant_id, company_id)
    references public.companies(tenant_id, id) on delete restrict,
  constraint nfses_client_fk foreign key (tenant_id, client_id)
    references public.clients(tenant_id, id) on delete set null
);

create unique index if not exists nfses_idempotency_uq
  on public.nfses(tenant_id, company_id, idempotency_key);

create index if not exists nfses_tenant_status_idx on public.nfses(tenant_id, status);
create index if not exists nfses_company_idx on public.nfses(company_id);

drop trigger if exists nfses_set_updated_at on public.nfses;
create trigger nfses_set_updated_at
before update on public.nfses
for each row execute function public.set_updated_at();

alter table public.nfses enable row level security;

drop policy if exists nfses_select_member on public.nfses;
create policy nfses_select_member
on public.nfses for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists nfses_insert_member on public.nfses;
create policy nfses_insert_member
on public.nfses for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

drop policy if exists nfses_update_member on public.nfses;
create policy nfses_update_member
on public.nfses for update
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

drop policy if exists nfses_delete_admin on public.nfses;
create policy nfses_delete_admin
on public.nfses for delete
to authenticated
using (public.is_tenant_admin(tenant_id));

-- Event timeline for NFS-e
create table if not exists public.nfse_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nfse_id uuid not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint nfse_events_nfse_fk foreign key (tenant_id, nfse_id)
    references public.nfses(tenant_id, id) on delete cascade
);

create index if not exists nfse_events_nfse_id_idx on public.nfse_events(nfse_id);
create index if not exists nfse_events_tenant_id_idx on public.nfse_events(tenant_id);

alter table public.nfse_events enable row level security;

drop policy if exists nfse_events_select_member on public.nfse_events;
create policy nfse_events_select_member
on public.nfse_events for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists nfse_events_insert_member on public.nfse_events;
create policy nfse_events_insert_member
on public.nfse_events for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

-- -----------------------------
-- WhatsApp message log (MVP)
-- -----------------------------
create table if not exists public.whatsapp_messages (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  company_id uuid,
  direction text not null check (direction in ('inbound','outbound')),
  from_number text,
  to_number text,
  body text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint whatsapp_company_fk foreign key (tenant_id, company_id)
    references public.companies(tenant_id, id) on delete set null
);

create index if not exists whatsapp_messages_tenant_created_idx
  on public.whatsapp_messages(tenant_id, created_at desc);

alter table public.whatsapp_messages enable row level security;

drop policy if exists whatsapp_messages_select_member on public.whatsapp_messages;
create policy whatsapp_messages_select_member
on public.whatsapp_messages for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists whatsapp_messages_insert_member on public.whatsapp_messages;
create policy whatsapp_messages_insert_member
on public.whatsapp_messages for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

-- -----------------------------
-- Audit log (basic)
-- -----------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  tenant_id uuid references public.tenants(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_table text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_tenant_created_idx
  on public.audit_log(tenant_id, created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists audit_log_select_member on public.audit_log;
create policy audit_log_select_member
on public.audit_log for select
to authenticated
using (tenant_id is null or public.is_tenant_member(tenant_id));

-- inserts allowed for authenticated user into their own tenant logs (service_role bypasses RLS anyway)
drop policy if exists audit_log_insert_member on public.audit_log;
create policy audit_log_insert_member
on public.audit_log for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and (tenant_id is null or public.is_tenant_member(tenant_id))
);