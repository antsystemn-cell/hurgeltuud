
-- Wallet settings (global config)
CREATE TABLE public.wallet_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_fee_per_order numeric NOT NULL DEFAULT 8000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage wallet settings"
  ON public.wallet_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'main_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'main_admin'::app_role));

CREATE POLICY "Authenticated users can read wallet settings"
  ON public.wallet_settings FOR SELECT TO authenticated
  USING (true);

-- Insert default settings row
INSERT INTO public.wallet_settings (delivery_fee_per_order) VALUES (8000);

-- Driver wallets
CREATE TABLE public.driver_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_user_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  total_earned numeric NOT NULL DEFAULT 0,
  total_withdrawn numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view own wallet"
  ON public.driver_wallets FOR SELECT TO authenticated
  USING (driver_user_id = auth.uid() AND has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Admins can manage all wallets"
  ON public.driver_wallets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'main_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'main_admin'::app_role));

-- Wallet transactions
CREATE TYPE public.wallet_tx_type AS ENUM ('delivery_earning', 'withdrawal', 'adjustment_add', 'adjustment_subtract', 'bank_transfer');

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.driver_wallets(id) ON DELETE CASCADE,
  driver_user_id uuid NOT NULL,
  type wallet_tx_type NOT NULL,
  amount numeric NOT NULL,
  balance_after numeric NOT NULL DEFAULT 0,
  description text,
  order_id uuid REFERENCES public.orders(id),
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view own transactions"
  ON public.wallet_transactions FOR SELECT TO authenticated
  USING (driver_user_id = auth.uid() AND has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Admins can manage all transactions"
  ON public.wallet_transactions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'main_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'main_admin'::app_role));

-- Withdrawal requests
CREATE TYPE public.withdrawal_status AS ENUM ('pending', 'approved', 'rejected', 'completed');

CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.driver_wallets(id) ON DELETE CASCADE,
  driver_user_id uuid NOT NULL,
  amount numeric NOT NULL,
  status withdrawal_status NOT NULL DEFAULT 'pending',
  bank_name text,
  bank_account text,
  note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view own withdrawal requests"
  ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (driver_user_id = auth.uid() AND has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Drivers can create withdrawal requests"
  ON public.withdrawal_requests FOR INSERT TO authenticated
  WITH CHECK (driver_user_id = auth.uid() AND has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Admins can manage all withdrawal requests"
  ON public.withdrawal_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'main_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'main_admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_wallet_settings_updated_at
  BEFORE UPDATE ON public.wallet_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_driver_wallets_updated_at
  BEFORE UPDATE ON public.driver_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to credit driver wallet on delivery
CREATE OR REPLACE FUNCTION public.credit_driver_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _fee numeric;
  _wallet_id uuid;
  _new_balance numeric;
BEGIN
  -- Only fire when fulfillment_status changes to 'delivered'
  IF NEW.fulfillment_status = 'delivered' AND OLD.fulfillment_status IS DISTINCT FROM 'delivered'
     AND NEW.assigned_driver_user_id IS NOT NULL THEN
    
    SELECT delivery_fee_per_order INTO _fee FROM public.wallet_settings LIMIT 1;
    IF _fee IS NULL THEN _fee := 8000; END IF;

    -- Ensure wallet exists
    INSERT INTO public.driver_wallets (driver_user_id, balance, total_earned)
    VALUES (NEW.assigned_driver_user_id, 0, 0)
    ON CONFLICT (driver_user_id) DO NOTHING;

    -- Update wallet balance
    UPDATE public.driver_wallets
    SET balance = balance + _fee,
        total_earned = total_earned + _fee
    WHERE driver_user_id = NEW.assigned_driver_user_id
    RETURNING id, balance INTO _wallet_id, _new_balance;

    -- Record transaction
    INSERT INTO public.wallet_transactions (wallet_id, driver_user_id, type, amount, balance_after, description, order_id, created_by_user_id)
    VALUES (_wallet_id, NEW.assigned_driver_user_id, 'delivery_earning', _fee, _new_balance,
            'Хүргэлт #' || NEW.internal_order_number, NEW.id, NEW.updated_by_user_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER credit_driver_wallet_on_delivery
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.credit_driver_on_delivery();
