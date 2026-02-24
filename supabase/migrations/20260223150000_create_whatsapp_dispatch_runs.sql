-- ============================================================
-- Tabela de auditoria de execuções do dispatcher/cron WhatsApp
-- Escrita/leitura exclusivamente via service role (sem policies).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_dispatch_runs (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at                      timestamptz NOT NULL DEFAULT now(),
  source                      text        NOT NULL DEFAULT 'unknown',
  picked                      int         NOT NULL DEFAULT 0,
  sent                        int         NOT NULL DEFAULT 0,
  failed                      int         NOT NULL DEFAULT 0,
  retried                     int         NOT NULL DEFAULT 0,
  schedules_picked            int         NOT NULL DEFAULT 0,
  jobs_created_from_schedules int         NOT NULL DEFAULT 0,
  duration_ms                 int,
  error                       text,
  meta                        jsonb       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS whatsapp_dispatch_runs_ran_at_idx
  ON public.whatsapp_dispatch_runs (ran_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_dispatch_runs_source_ran_at_idx
  ON public.whatsapp_dispatch_runs (source, ran_at DESC);

-- RLS habilitado; nenhuma policy criada intencionalmente.
-- Acesso somente via service role (bypassa RLS).
ALTER TABLE public.whatsapp_dispatch_runs ENABLE ROW LEVEL SECURITY;
