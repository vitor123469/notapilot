create table if not exists public.whatsapp_delivery_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null default 'meta',
  message_id text,
  status text not null,
  recipient_id text,
  timestamp timestamptz,
  error_code text,
  error_title text,
  error_message text,
  raw jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_delivery_events_tenant_message_idx
  on public.whatsapp_delivery_events (tenant_id, message_id);
