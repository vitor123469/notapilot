-- =========================================
-- Day 10 - Company fiscal settings
-- =========================================

create table if not exists public.company_fiscal_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  company_id uuid not null,

  municipality_name text,
  municipality_ibge_code text,
  state_uf text check (state_uf is null or length(state_uf) = 2),

  address_street text,
  address_number text,
  address_complement text,
  address_district text,
  address_city text,
  address_zip text check (address_zip is null or address_zip ~ '^[0-9]+$'),

  tax_regime text check (tax_regime in ('simples','lucro_presumido','lucro_real','mei','outro')),
  cnae text check (cnae is null or cnae ~ '^[0-9]+$'),
  service_list_item text,
  service_code text,
  iss_rate numeric(5,2) check (iss_rate is null or (iss_rate >= 0 and iss_rate <= 100)),
  default_service_description text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_fiscal_settings_company_fk
    foreign key (tenant_id, company_id)
    references public.companies(tenant_id, id)
    on delete cascade,
  constraint company_fiscal_settings_tenant_company_uq unique (tenant_id, company_id)
);

create index if not exists company_fiscal_settings_tenant_idx
  on public.company_fiscal_settings(tenant_id);

create index if not exists company_fiscal_settings_company_idx
  on public.company_fiscal_settings(company_id);

drop trigger if exists company_fiscal_settings_set_updated_at on public.company_fiscal_settings;
create trigger company_fiscal_settings_set_updated_at
before update on public.company_fiscal_settings
for each row execute function public.set_updated_at();

alter table public.company_fiscal_settings enable row level security;

drop policy if exists company_fiscal_settings_select_member on public.company_fiscal_settings;
create policy company_fiscal_settings_select_member
on public.company_fiscal_settings for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists company_fiscal_settings_insert_member on public.company_fiscal_settings;
create policy company_fiscal_settings_insert_member
on public.company_fiscal_settings for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

drop policy if exists company_fiscal_settings_update_member on public.company_fiscal_settings;
create policy company_fiscal_settings_update_member
on public.company_fiscal_settings for update
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

drop policy if exists company_fiscal_settings_delete_admin on public.company_fiscal_settings;
create policy company_fiscal_settings_delete_admin
on public.company_fiscal_settings for delete
to authenticated
using (public.is_tenant_admin(tenant_id));
