
-- Create a view for operators that excludes sensitive columns
CREATE VIEW public.source_systems_safe AS
SELECT id, name, code, active, notes, created_at, updated_at
FROM public.source_systems;

-- Drop the old operator SELECT policy
DROP POLICY "Operators can view source systems" ON public.source_systems;

-- Add a new operator SELECT policy on the view is not possible via RLS on views,
-- so instead restrict the operator policy to only allow via the view.
-- Actually, views inherit the base table's RLS. Let's use a different approach:
-- Grant operators SELECT only on specific columns using a restricted policy.

-- We can't do column-level RLS in Postgres, so the correct approach is:
-- 1. Revoke direct access for operators on source_systems
-- 2. Create the view with restricted columns  
-- 3. Grant access on the view

-- Since RLS on views checks the underlying table policies, we need to keep
-- a policy but restrict operator access to go through the view only.
-- The simplest secure approach: remove operator SELECT on the base table,
-- and create a security definer function or use the view with security_invoker = false.

-- Drop the approach above, use a SECURITY DEFINER view instead
DROP VIEW IF EXISTS public.source_systems_safe;

CREATE VIEW public.source_systems_safe 
WITH (security_invoker = false, security_barrier = true) AS
SELECT id, name, code, active, notes, created_at, updated_at
FROM public.source_systems;

-- Grant select on the view to authenticated
GRANT SELECT ON public.source_systems_safe TO authenticated;
