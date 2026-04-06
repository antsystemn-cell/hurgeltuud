
-- Drop the problematic view
DROP VIEW IF EXISTS public.source_systems_safe;

-- Use a security definer function instead to return safe columns only
CREATE OR REPLACE FUNCTION public.get_source_systems_safe()
RETURNS TABLE(
  id uuid,
  name text,
  code text,
  active boolean,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, code, active, notes, created_at, updated_at
  FROM public.source_systems
  ORDER BY name;
$$;
