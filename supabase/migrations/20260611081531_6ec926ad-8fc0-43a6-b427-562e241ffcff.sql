REVOKE EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, text) TO authenticated;