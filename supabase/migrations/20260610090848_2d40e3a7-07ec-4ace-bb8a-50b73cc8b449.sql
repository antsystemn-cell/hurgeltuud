-- ============================================================
-- Swift Delivery Hub: production hardening (DB layer)
-- ============================================================

-- Extensions for scheduled retry
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1) Outbound API reliability columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS last_api_error text,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_retry_at timestamptz;

-- 2) Webhook idempotency: a given event_id may only be logged once
DROP INDEX IF EXISTS public.idx_webhook_logs_event_id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_logs_event_id
  ON public.webhook_logs (event_id) WHERE event_id IS NOT NULL;

-- 3) Idempotent / monotonic status transition guard
-- Prevents reopening terminal orders (delivered/cancelled) from stale
-- offline replays, duplicate clicks, or out-of-order inbound syncs.
-- main_admin can still override for genuine corrections.
CREATE OR REPLACE FUNCTION public.enforce_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_admin boolean := false;
BEGIN
  IF NEW.fulfillment_status = OLD.fulfillment_status THEN
    RETURN NEW; -- no status change, nothing to guard
  END IF;

  IF _uid IS NOT NULL THEN
    _is_admin := public.has_role(_uid, 'main_admin');
  END IF;

  -- Block transitions OUT of a terminal state unless an admin is correcting it
  IF OLD.fulfillment_status IN ('delivered','cancelled') AND NOT _is_admin THEN
    RAISE EXCEPTION 'Order % is already %, status cannot be changed',
      OLD.internal_order_number, OLD.fulfillment_status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_status_transition ON public.orders;
CREATE TRIGGER trg_enforce_order_status_transition
  BEFORE UPDATE OF fulfillment_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_status_transition();

-- 4) Assignment lock: a finished order's driver cannot be silently
-- reassigned, and an active order's driver cannot be overwritten by a
-- different driver once delivery is under way (operator/admin may
-- correct earlier stages). Prevents the same order landing with two
-- drivers via a race.
CREATE OR REPLACE FUNCTION public.enforce_driver_assignment_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_privileged boolean := false;
BEGIN
  IF NEW.assigned_driver_user_id IS DISTINCT FROM OLD.assigned_driver_user_id THEN
    IF _uid IS NOT NULL THEN
      _is_privileged := public.has_role(_uid, 'main_admin')
                     OR public.has_role(_uid, 'operator');
    ELSE
      -- service_role (edge functions / operator portal) acts on behalf of staff
      _is_privileged := true;
    END IF;

    -- Once terminal, assignment is frozen for everyone except admin
    IF OLD.fulfillment_status IN ('delivered','cancelled')
       AND NOT (_uid IS NOT NULL AND public.has_role(_uid,'main_admin')) THEN
      RAISE EXCEPTION 'Order % is already %, driver cannot be reassigned',
        OLD.internal_order_number, OLD.fulfillment_status
        USING ERRCODE = 'check_violation';
    END IF;

    -- Non-staff (e.g. a driver) may only self-claim an unassigned order
    IF NOT _is_privileged
       AND OLD.assigned_driver_user_id IS NOT NULL
       AND OLD.assigned_driver_user_id IS DISTINCT FROM NEW.assigned_driver_user_id THEN
      RAISE EXCEPTION 'Order % is already assigned to another driver',
        OLD.internal_order_number
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_driver_assignment_lock ON public.orders;
CREATE TRIGGER trg_enforce_driver_assignment_lock
  BEFORE UPDATE OF assigned_driver_user_id ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_driver_assignment_lock();