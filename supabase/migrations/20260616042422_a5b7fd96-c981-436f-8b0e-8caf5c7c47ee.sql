-- Telegram notification module: additive fields only, no existing columns changed.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id text,
  ADD COLUMN IF NOT EXISTS telegram_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS telegram_notified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS telegram_notify_error text,
  ADD COLUMN IF NOT EXISTS telegram_last_sent_driver_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

-- Extend the safe drivers RPC to also expose Telegram settings (still security definer).
DROP FUNCTION IF EXISTS public.get_drivers_safe();
CREATE FUNCTION public.get_drivers_safe()
 RETURNS TABLE(user_id uuid, full_name text, phone text, active boolean, telegram_chat_id text, telegram_enabled boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.user_id, p.full_name, p.phone, p.active, p.telegram_chat_id, p.telegram_enabled
  FROM public.profiles p
  WHERE p.user_id IN (
    SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'driver'
  )
  ORDER BY p.full_name;
$function$;