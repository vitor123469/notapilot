-- ============================================================
-- Recria o unique index de dedupe em whatsapp_jobs sem cláusula
-- WHERE, para que ON CONFLICT (tenant_id, dedupe_key) funcione.
-- Postgres já permite múltiplas linhas com dedupe_key NULL num
-- índice único sem precisar de filtro parcial.
-- ============================================================

DROP INDEX IF EXISTS public.whatsapp_jobs_tenant_dedupe_key_udx;
DROP INDEX IF EXISTS public.whatsapp_jobs_dedupe_uq;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_jobs_dedupe_uq
  ON public.whatsapp_jobs (tenant_id, dedupe_key);
