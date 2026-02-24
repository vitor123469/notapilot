-- ============================================================
-- RPC: pick_due_whatsapp_schedules
-- Atomically picks enabled schedules whose next_run_at <= now,
-- advances next_run_at by interval_seconds, and returns the
-- rows with the *original* (due) next_run_at so the caller can
-- use it as a dedupe key for the spawned job.
-- FOR UPDATE SKIP LOCKED prevents double-dispatch under concurrency.
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
  due_next_run_at  timestamptz,   -- the run_at that triggered this pick
  next_run_at      timestamptz,   -- already-advanced value after update
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
    update public.whatsapp_schedules s
    set
      next_run_at = s.next_run_at + (s.interval_seconds * interval '1 second'),
      updated_at  = now()
    from (
      select id
      from public.whatsapp_schedules
      where enabled      = true
        and next_run_at <= now()
      order by next_run_at
      limit batch_size
      for update skip locked
    ) due
    where s.id = due.id
    returning
      s.id,
      s.tenant_id,
      s.schedule_key,
      s.template_key,
      s.enabled,
      -- due_next_run_at: the original value before we advanced it
      s.next_run_at - (s.interval_seconds * interval '1 second') as due_next_run_at,
      s.next_run_at,
      s.interval_seconds,
      s.payload,
      s.created_at,
      s.updated_at;
end;
$$;
