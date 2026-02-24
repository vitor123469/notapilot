-- ============================================================
-- Fix: pick_due_whatsapp_schedules
-- Resolves "column reference id is ambiguous" by using a CTE
-- that aliases the PK to schedule_id, keeping every column
-- reference unambiguous throughout the UPDATE … FROM … query.
-- ============================================================

create or replace function public.pick_due_whatsapp_schedules(
  batch_size int default 50
)
returns table (
  id               uuid,
  tenant_id        uuid,
  schedule_key     text,
  template_key     text,
  enabled          boolean,
  due_next_run_at  timestamptz,
  next_run_at      timestamptz,
  interval_seconds int,
  payload          jsonb,
  created_at       timestamptz,
  updated_at       timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    with due as (
      select
        ws.id           as schedule_id,
        ws.next_run_at  as due_next_run_at
      from public.whatsapp_schedules ws
      where ws.enabled      = true
        and ws.next_run_at <= now()
      order by ws.next_run_at
      limit batch_size
      for update skip locked
    )
    update public.whatsapp_schedules s
    set
      next_run_at = s.next_run_at + (s.interval_seconds * interval '1 second'),
      updated_at  = now()
    from due
    where s.id = due.schedule_id
    returning
      s.id,
      s.tenant_id,
      s.schedule_key,
      s.template_key,
      s.enabled,
      due.due_next_run_at,
      s.next_run_at,
      s.interval_seconds,
      s.payload,
      s.created_at,
      s.updated_at;
end;
$$;

revoke all     on function public.pick_due_whatsapp_schedules(int) from public;
grant  execute on function public.pick_due_whatsapp_schedules(int) to   service_role;
