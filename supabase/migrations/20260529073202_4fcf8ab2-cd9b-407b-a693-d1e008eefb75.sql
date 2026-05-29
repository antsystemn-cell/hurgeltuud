ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_collected_in_cash boolean;

ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS event_id text;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_id
  ON public.webhook_logs (event_id)
  WHERE event_id IS NOT NULL;