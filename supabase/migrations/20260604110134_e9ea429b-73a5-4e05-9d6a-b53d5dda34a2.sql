REVOKE EXECUTE ON FUNCTION public.get_drivers_safe() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_drivers_safe() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_drivers_safe() TO authenticated;