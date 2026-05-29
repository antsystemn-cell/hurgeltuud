ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS merchant_name text,
  ADD COLUMN IF NOT EXISTS merchant_code text;

CREATE INDEX IF NOT EXISTS idx_orders_merchant_code ON public.orders (merchant_code);