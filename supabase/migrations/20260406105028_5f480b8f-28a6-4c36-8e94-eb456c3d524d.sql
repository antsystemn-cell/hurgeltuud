
-- FIX 1: Remove operator direct SELECT on source_systems base table
-- Operators should only use source_systems_safe view (which is already set up)
DROP POLICY IF EXISTS "Operators can view source systems" ON public.source_systems;

-- FIX 2: Remove client-side audit_logs INSERT policy
DROP POLICY IF EXISTS "Authenticated can insert own audit logs" ON public.audit_logs;

-- Create a SECURITY DEFINER function to write audit logs from triggers
CREATE OR REPLACE FUNCTION public.log_order_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _action text;
  _details jsonb;
  _user_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'order_created';
    _user_id := NEW.created_by_user_id;
    _details := jsonb_build_object(
      'fulfillment_status', NEW.fulfillment_status,
      'payment_status', NEW.payment_status,
      'customer_name', NEW.customer_name
    );
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (_user_id, _action, 'order', NEW.id, _details);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    _user_id := NEW.updated_by_user_id;
    IF OLD.fulfillment_status IS DISTINCT FROM NEW.fulfillment_status THEN
      INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (_user_id, 'fulfillment_status_changed', 'order', NEW.id,
        jsonb_build_object('old', OLD.fulfillment_status, 'new', NEW.fulfillment_status));
    END IF;
    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
      INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (_user_id, 'payment_status_changed', 'order', NEW.id,
        jsonb_build_object('old', OLD.payment_status, 'new', NEW.payment_status));
    END IF;
    IF OLD.assigned_driver_user_id IS DISTINCT FROM NEW.assigned_driver_user_id THEN
      INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (_user_id, 'driver_assigned', 'order', NEW.id,
        jsonb_build_object('old_driver', OLD.assigned_driver_user_id, 'new_driver', NEW.assigned_driver_user_id));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'order_deleted', 'order', OLD.id,
      jsonb_build_object('customer_name', OLD.customer_name, 'internal_order_number', OLD.internal_order_number));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Attach trigger to orders table
CREATE TRIGGER trg_order_audit
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_audit();
