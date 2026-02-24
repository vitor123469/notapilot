-- ============================================================
-- Trigger: enfileira WhatsApp automaticamente ao inserir
--          um nfse_event com tipo ISSUE_AUTHORIZED ou ISSUE_REJECTED
-- ============================================================

create or replace function public.enqueue_whatsapp_on_nfse_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template_key  text;
  v_company_id    uuid;
  v_trade_name    text;
  v_whatsapp_phone text;
  v_service_value numeric(14,2);
  v_pdf_url       text;
  v_xml_url       text;
  v_error_code    text;
  v_error_message text;
begin
  -- Só processa eventos relevantes
  if NEW.event_type = 'ISSUE_AUTHORIZED' then
    v_template_key := 'nfse_authorized';
  elsif NEW.event_type = 'ISSUE_REJECTED' then
    v_template_key := 'nfse_rejected';
  else
    return NEW;
  end if;

  begin
    -- Busca dados da nota e da empresa
    select
      n.company_id,
      n.service_value,
      n.pdf_url,
      n.xml_url,
      n.error_code,
      coalesce(n.error_message, NEW.payload->>'error_message'),
      c.trade_name,
      c.whatsapp_phone
    into
      v_company_id,
      v_service_value,
      v_pdf_url,
      v_xml_url,
      v_error_code,
      v_error_message,
      v_trade_name,
      v_whatsapp_phone
    from public.nfses n
    join public.companies c
      on c.tenant_id = n.tenant_id
     and c.id        = n.company_id
    where n.tenant_id = NEW.tenant_id
      and n.id        = NEW.nfse_id;

    -- Empresa sem WhatsApp configurado: ignora silenciosamente
    if v_whatsapp_phone is null then
      return NEW;
    end if;

    insert into public.whatsapp_jobs (
      tenant_id,
      run_at,
      to_phone,
      template_key,
      payload,
      dedupe_key
    )
    values (
      NEW.tenant_id,
      now(),
      v_whatsapp_phone,
      v_template_key,
      jsonb_build_object(
        'trade_name',     v_trade_name,
        'service_value',  v_service_value,
        'pdf_url',        v_pdf_url,
        'xml_url',        v_xml_url,
        'error_code',     v_error_code,
        'error_message',  v_error_message
      ),
      'nfse_event:' || NEW.id::text
    )
    on conflict (tenant_id, dedupe_key) do nothing;

  exception
    when others then
      -- Nunca quebrar a emissão da nota
      null;
  end;

  return NEW;
end;
$$;

-- ============================================================
-- Trigger idempotente
-- ============================================================

drop trigger if exists trg_nfse_events_enqueue_whatsapp on public.nfse_events;

create trigger trg_nfse_events_enqueue_whatsapp
  after insert on public.nfse_events
  for each row
  execute function public.enqueue_whatsapp_on_nfse_event();
