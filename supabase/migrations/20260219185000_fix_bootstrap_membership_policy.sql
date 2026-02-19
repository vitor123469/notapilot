-- Fix bootstrap owner membership policy to avoid circular RLS dependency on tenants.

create or replace function public.is_tenant_creator(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenants t
    where t.id = p_tenant_id
      and t.created_by = auth.uid()
  );
$$;

drop policy if exists tenant_members_insert_bootstrap_owner on public.tenant_members;
create policy tenant_members_insert_bootstrap_owner
on public.tenant_members for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'owner'
  and public.is_tenant_creator(tenant_id)
);
