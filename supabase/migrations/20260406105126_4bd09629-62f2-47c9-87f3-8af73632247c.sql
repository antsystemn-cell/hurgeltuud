
-- Recreate view without security_invoker so it runs as the view owner (bypasses base table RLS)
DROP VIEW IF EXISTS public.source_systems_safe;

CREATE VIEW public.source_systems_safe AS
SELECT id, name, code, active, notes, created_at, updated_at
FROM public.source_systems;

-- Revoke default access, grant only to authenticated
REVOKE ALL ON public.source_systems_safe FROM PUBLIC;
GRANT SELECT ON public.source_systems_safe TO authenticated;
