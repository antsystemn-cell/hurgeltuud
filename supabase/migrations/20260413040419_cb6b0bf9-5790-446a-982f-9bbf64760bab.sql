
CREATE TABLE public.pwa_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  prompt_frequency_hours integer NOT NULL DEFAULT 24,
  prompt_title text NOT NULL DEFAULT 'Апп суулгах',
  prompt_message text NOT NULL DEFAULT 'Энэ аппыг утсандаа суулгаснаар илүү хурдан, тохиромжтой ашиглах боломжтой.',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pwa_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read (needed for install prompt on all roles)
CREATE POLICY "Anyone can read pwa settings"
ON public.pwa_settings
FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage pwa settings"
ON public.pwa_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'main_admin'))
WITH CHECK (public.has_role(auth.uid(), 'main_admin'));

-- Insert default row
INSERT INTO public.pwa_settings (enabled, prompt_frequency_hours, prompt_title, prompt_message)
VALUES (true, 24, 'Апп суулгах', 'Энэ аппыг утсандаа суулгаснаар илүү хурдан, тохиромжтой ашиглах боломжтой.');

-- Trigger for updated_at
CREATE TRIGGER update_pwa_settings_updated_at
BEFORE UPDATE ON public.pwa_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
