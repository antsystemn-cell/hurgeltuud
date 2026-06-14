ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_outcome text,
  ADD COLUMN IF NOT EXISTS delivery_outcome_note text,
  ADD COLUMN IF NOT EXISTS delivery_proof_url text,
  ADD COLUMN IF NOT EXISTS delivery_outcome_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS delivery_outcome_by uuid;