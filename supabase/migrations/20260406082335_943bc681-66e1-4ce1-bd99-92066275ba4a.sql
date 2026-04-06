
DROP POLICY "Authenticated can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated can insert own audit logs" ON public.audit_logs 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);
