CREATE OR REPLACE FUNCTION public.request_withdrawal(
  _amount numeric,
  _bank_name text DEFAULT NULL,
  _bank_account text DEFAULT NULL,
  _note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _wallet public.driver_wallets%ROWTYPE;
  _req_id uuid;
  _pending_total numeric;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Нэвтрэх шаардлагатай';
  END IF;

  IF NOT public.has_role(_uid, 'driver') THEN
    RAISE EXCEPTION 'Зөвхөн жолооч мөнгө татах хүсэлт илгээх боломжтой';
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Дүн буруу байна';
  END IF;

  SELECT * INTO _wallet FROM public.driver_wallets WHERE driver_user_id = _uid;
  IF _wallet.id IS NULL THEN
    RAISE EXCEPTION 'Хэтэвч олдсонгүй';
  END IF;

  -- Reserve against already-pending requests so a driver cannot over-withdraw
  SELECT COALESCE(SUM(amount), 0) INTO _pending_total
  FROM public.withdrawal_requests
  WHERE driver_user_id = _uid AND status IN ('pending', 'approved');

  IF _amount > (_wallet.balance - _pending_total) THEN
    RAISE EXCEPTION 'Боломжит үлдэгдлээс их дүн байна';
  END IF;

  INSERT INTO public.withdrawal_requests (wallet_id, driver_user_id, amount, bank_name, bank_account, note)
  VALUES (_wallet.id, _uid, _amount, _bank_name, _bank_account, _note)
  RETURNING id INTO _req_id;

  RETURN _req_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, text) TO authenticated;