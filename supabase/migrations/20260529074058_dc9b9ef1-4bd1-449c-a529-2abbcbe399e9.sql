-- Remove default PUBLIC execute grant from all SECURITY DEFINER functions.
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_order_audit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_driver_on_delivery() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_source_systems_safe() FROM PUBLIC;

-- Re-grant only to authenticated for functions that need it:
--   has_role / get_user_role are referenced inside RLS policies (evaluated as the querying role)
--   get_source_systems_safe is called by operators/admins via RPC
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_source_systems_safe() TO authenticated;

-- service_role keeps full access for edge functions / triggers context
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_source_systems_safe() TO service_role;