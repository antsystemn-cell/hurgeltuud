ALTER TABLE public.partner_sessions
  ADD COLUMN IF NOT EXISTS merchant_code text,
  ADD COLUMN IF NOT EXISTS merchant_name text;

CREATE INDEX IF NOT EXISTS idx_partner_sessions_token ON public.partner_sessions (token);