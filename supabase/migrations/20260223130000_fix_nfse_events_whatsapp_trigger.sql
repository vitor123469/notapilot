-- ============================================================
-- Corrige enqueue_whatsapp_on_nfse_event:
--   - separa busca de NFSe e de companies em dois SELECTs
--   - usa COALESCE(trade_name, legal_name) para nome da empresa
--   - inclui fallback de error_code do payload do evento
--   - hardena search_path com pg_temp
-- ============================================================

CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_on_nfse_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id    uuid;
  v_to_phone      text;
  v_trade_name    text;
  v_service_value numeric;
  v_pdf_url       text;
  v_xml_url       text;
  v_error_code    text;
  v_error_message text;
  v_template_key  text;
BEGIN
  IF NEW.event_type NOT IN ('ISSUE_AUTHORIZED', 'ISSUE_REJECTED') THEN
    RETURN NEW;
  END IF;

  BEGIN
    -- Pega dados da NFSe
    SELECT n.company_id, n.service_value, n.pdf_url, n.xml_url, n.error_code, n.error_message
      INTO v_company_id, v_service_value, v_pdf_url, v_xml_url, v_error_code, v_error_message
    FROM public.nfses n
    WHERE n.id = NEW.nfse_id;

    IF v_company_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Pega whatsapp_phone e nome da empresa (trade_name com fallback em legal_name)
    SELECT c.whatsapp_phone, COALESCE(NULLIF(c.trade_name, ''), c.legal_name)
      INTO v_to_phone, v_trade_name
    FROM public.companies c
    WHERE c.id = v_company_id;

    IF v_to_phone IS NULL THEN
      RETURN NEW;
    END IF;

    -- Prioriza campos da nfses; fallback no payload do evento
    v_error_message := COALESCE(v_error_message, NEW.payload->>'error_message');
    v_error_code    := COALESCE(v_error_code,    NEW.payload->>'error_code');

    v_template_key := CASE
      WHEN NEW.event_type = 'ISSUE_AUTHORIZED' THEN 'nfse_authorized'
      ELSE 'nfse_rejected'
    END;

    INSERT INTO public.whatsapp_jobs (
      tenant_id, run_at, to_phone, template_key, payload, dedupe_key
    )
    VALUES (
      NEW.tenant_id,
      now(),
      v_to_phone,
      v_template_key,
      jsonb_build_object(
        'trade_name',    v_trade_name,
        'service_value', v_service_value,
        'pdf_url',       v_pdf_url,
        'xml_url',       v_xml_url,
        'error_code',    v_error_code,
        'error_message', v_error_message
      ),
      'nfse_event:' || NEW.id::text
    )
    ON CONFLICT (tenant_id, dedupe_key) DO NOTHING;

  EXCEPTION WHEN OTHERS THEN
    -- nunca quebrar a inserção do evento
    NULL;
  END;

  RETURN NEW;
END;
$$;

-- ============================================================
-- Permissões: apenas service_role pode executar
-- ============================================================

REVOKE ALL ON FUNCTION public.enqueue_whatsapp_on_nfse_event() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_whatsapp_on_nfse_event() TO service_role;
