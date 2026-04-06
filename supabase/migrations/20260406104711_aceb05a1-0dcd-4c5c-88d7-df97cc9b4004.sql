
-- Fix: switch view to security_invoker = true
DROP VIEW IF EXISTS public.source_systems_safe;

CREATE VIEW public.source_systems_safe 
WITH (security_invoker = true, security_barrier = true) AS
SELECT id, name, code, active, notes, created_at, updated_at
FROM public.source_systems;

GRANT SELECT ON public.source_systems_safe TO authenticated;

-- Re-add operator SELECT on base table (needed for the view with security_invoker)
CREATE POLICY "Operators can view source systems"
ON public.source_systems
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'operator'::app_role));
