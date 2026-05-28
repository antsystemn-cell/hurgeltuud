ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS last_sync_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS sync_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sync_error text;