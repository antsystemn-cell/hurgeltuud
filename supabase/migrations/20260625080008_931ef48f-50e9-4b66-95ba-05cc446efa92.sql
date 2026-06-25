CREATE OR REPLACE FUNCTION public.enforce_order_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _is_staff boolean := false;
BEGIN
  IF NEW.fulfillment_status = OLD.fulfillment_status THEN
    RETURN NEW; -- no status change, nothing to guard
  END IF;

  -- Admins AND operators run the delivery hub and may correct a mistakenly
  -- terminal order (e.g. an accidentally cancelled API-sourced delivery).
  -- This applies uniformly to every API-connected source system since the
  -- guard lives in the DB, independent of the inbound channel.
  IF _uid IS NOT NULL THEN
    _is_staff := public.has_role(_uid, 'main_admin') OR public.has_role(_uid, 'operator');
  END IF;

  -- Block transitions OUT of a terminal state unless staff is correcting it.
  IF OLD.fulfillment_status IN ('delivered','cancelled') AND NOT _is_staff THEN
    RAISE EXCEPTION 'Order % is already %, status cannot be changed',
      OLD.internal_order_number, OLD.fulfillment_status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;