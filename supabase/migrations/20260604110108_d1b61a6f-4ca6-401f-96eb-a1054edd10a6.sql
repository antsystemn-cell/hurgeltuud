CREATE OR REPLACE FUNCTION public.get_drivers_safe()
RETURNS TABLE(user_id uuid, full_name text, phone text, active boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name, p.phone, p.active
  FROM public.profiles p
  WHERE p.user_id IN (
    SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'driver'
  )
  ORDER BY p.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_drivers_safe() TO authenticated;