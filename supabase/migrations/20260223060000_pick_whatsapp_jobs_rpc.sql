-- ============================================================
-- RPC: pick_whatsapp_jobs
-- Atomically locks up to `batch_size` pending jobs that are
-- ready to run, protecting against concurrent dispatchers with
-- FOR UPDATE SKIP LOCKED.
-- Returns the full row set so the caller does not need a second
-- round-trip.
-- ============================================================

create or replace function public.pick_whatsapp_jobs(
  batch_size int default 50,
  locker     text default 'cron'
)
returns setof public.whatsapp_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update public.whatsapp_jobs
    set
      status    = 'processing',
      locked_at = now(),
      locked_by = locker,
      updated_at = now()
    where id in (
      select id
      from public.whatsapp_jobs
      where status  = 'pending'
        and run_at <= now()
      order by run_at
      limit batch_size
      for update skip locked
    )
    returning *;
end;
$$;
