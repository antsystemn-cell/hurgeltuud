import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BankInfo {
  bank_name: string | null;
  bank_account: string | null;
  bank_account_holder: string | null;
}

export function useMyProfile(userId: string) {
  return useQuery({
    queryKey: ["my_profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, bank_name, bank_account, bank_account_holder")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateBankInfo(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (info: BankInfo) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          bank_name: info.bank_name?.trim() || null,
          bank_account: info.bank_account?.trim() || null,
          bank_account_holder: info.bank_account_holder?.trim() || null,
        })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my_profile", userId] }),
  });
}
