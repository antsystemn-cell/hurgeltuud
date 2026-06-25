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
    RETURN NEW;
  END IF;

  IF _uid IS NULL THEN
    -- Server-side API calls made with the backend service role (partner portal,
    -- inbound status sync, maintenance jobs) do not carry an end-user JWT. These
    -- calls are already authenticated/scoped in the Edge Function, so allow them
    -- to correct mistakenly terminal orders.
    _is_staff := true;
  ELSE
    _is_staff := public.has_role(_uid, 'main_admin') OR public.has_role(_uid, 'operator');
  END IF;

  IF OLD.fulfillment_status IN ('delivered','cancelled') AND NOT _is_staff THEN
    RAISE EXCEPTION 'Order % is already %, status cannot be changed',
      OLD.internal_order_number, OLD.fulfillment_status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;