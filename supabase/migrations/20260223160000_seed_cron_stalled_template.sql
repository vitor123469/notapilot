-- ============================================================
-- Seed: template 'cron_stalled' para alertar admin quando o
-- dispatcher ficar parado por mais de 10 minutos.
--
-- Usa LIKE '4ec37f55%' para localizar o tenant principal sem
-- precisar hardcodar o UUID completo. ON CONFLICT = idempotente.
-- ============================================================

DO $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE id::text LIKE '4ec37f55%'
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'cron_stalled template seed: tenant 4ec37f55... not found, skipping';
    RETURN;
  END IF;

  INSERT INTO public.whatsapp_templates (tenant_id, key, body, enabled)
  VALUES (
    v_tenant_id,
    'cron_stalled',
    '⚠️ *Cron parado!* O dispatcher não rodou há {{gap_minutes}} minuto(s). Verifique o sistema.',
    true
  )
  ON CONFLICT (tenant_id, key) DO NOTHING;

  RAISE NOTICE 'cron_stalled template seeded for tenant %', v_tenant_id;
END;
$$;
