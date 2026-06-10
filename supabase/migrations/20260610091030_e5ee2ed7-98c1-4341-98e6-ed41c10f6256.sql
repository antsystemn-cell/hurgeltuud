DROP INDEX IF EXISTS public.uq_webhook_logs_event_id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_logs_event_id
  ON public.webhook_logs (event_id);