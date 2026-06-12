CREATE OR REPLACE FUNCTION public.prevent_driver_delivered_payment_coupling()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NOT NULL
     AND public.has_role(_uid, 'driver')
     AND OLD.fulfillment_status IS DISTINCT FROM 'delivered'
     AND NEW.fulfillment_status = 'delivered'
     AND (
       NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.payment_collected_in_cash IS DISTINCT FROM OLD.payment_collected_in_cash
     ) THEN
    NEW.payment_status := OLD.payment_status;
    NEW.payment_collected_in_cash := OLD.payment_collected_in_cash;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_driver_delivered_payment_coupling ON public.orders;
CREATE TRIGGER trg_prevent_driver_delivered_payment_coupling
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.prevent_driver_delivered_payment_coupling();