CREATE TABLE public.partner_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token text NOT NULL UNIQUE,
  source_system_id uuid NOT NULL REFERENCES public.source_systems(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_sessions_token ON public.partner_sessions(token);
CREATE INDEX idx_partner_sessions_source ON public.partner_sessions(source_system_id);

GRANT ALL ON public.partner_sessions TO service_role;

ALTER TABLE public.partner_sessions ENABLE ROW LEVEL SECURITY;

-- No policies: only edge functions (service_role) may read/write partner sessions.

-- Helper: resolve drivers list (reuse existing get_drivers_safe via service role in edge fn).
-- Helper function to validate a partner token and return the bound source system id.
CREATE OR REPLACE FUNCTION public.resolve_partner_session(_token text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT source_system_id
  FROM public.partner_sessions
  WHERE token = _token
    AND expires_at > now()
  LIMIT 1;
$$;