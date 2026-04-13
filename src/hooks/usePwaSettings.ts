import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PwaSettings {
  id: string;
  enabled: boolean;
  prompt_frequency_hours: number;
  prompt_title: string;
  prompt_message: string;
}

export function usePwaSettings() {
  return useQuery({
    queryKey: ["pwa_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pwa_settings")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return data as PwaSettings;
    },
  });
}

export function useUpdatePwaSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<Omit<PwaSettings, "id">>) => {
      // Get the single row first
      const { data: existing, error: fetchErr } = await supabase
        .from("pwa_settings")
        .select("id")
        .limit(1)
        .single();
      if (fetchErr) throw fetchErr;

      const { error } = await supabase
        .from("pwa_settings")
        .update(settings)
        .eq("id", existing.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pwa_settings"] }),
  });
}
