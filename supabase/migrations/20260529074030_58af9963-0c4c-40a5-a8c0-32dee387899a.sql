-- 1) Restrict profiles SELECT so users only read their own profile.
--    Admins and operators still need to read all profiles (e.g. to assign drivers).
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins and operators can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'main_admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- 2) Add WITH CHECK to the user_roles UPDATE policy to constrain admin updates.
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'main_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'main_admin'::app_role));

-- 3) Lock down SECURITY DEFINER functions.
--    Trigger functions are never called via the API; remove all direct execute grants.
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_order_audit() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_driver_on_delivery() FROM anon, authenticated;

--    Helper functions: anon never needs to call these. authenticated keeps execute
--    because has_role/get_user_role are referenced inside RLS policies.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_source_systems_safe() FROM anon;