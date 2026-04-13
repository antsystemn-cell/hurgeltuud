import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useWalletSettings() {
  return useQuery({
    queryKey: ["wallet_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_settings")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateWalletSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, deliveryFeePerOrder }: { id: string; deliveryFeePerOrder: number }) => {
      const { error } = await supabase
        .from("wallet_settings")
        .update({ delivery_fee_per_order: deliveryFeePerOrder })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wallet_settings"] }),
  });
}

export function useDriverWallet(driverUserId: string) {
  return useQuery({
    queryKey: ["driver_wallet", driverUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_wallets")
        .select("*")
        .eq("driver_user_id", driverUserId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!driverUserId,
  });
}

export function useAllDriverWallets() {
  return useQuery({
    queryKey: ["driver_wallets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_wallets")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useWalletTransactions(driverUserId: string) {
  return useQuery({
    queryKey: ["wallet_transactions", driverUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("driver_user_id", driverUserId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!driverUserId,
  });
}

export function useWithdrawalRequests(driverUserId?: string) {
  return useQuery({
    queryKey: ["withdrawal_requests", driverUserId],
    queryFn: async () => {
      let q = supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (driverUserId) {
        q = q.eq("driver_user_id", driverUserId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateWithdrawalRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      walletId,
      driverUserId,
      amount,
      bankName,
      bankAccount,
      note,
    }: {
      walletId: string;
      driverUserId: string;
      amount: number;
      bankName?: string;
      bankAccount?: string;
      note?: string;
    }) => {
      const { error } = await supabase.from("withdrawal_requests").insert({
        wallet_id: walletId,
        driver_user_id: driverUserId,
        amount,
        bank_name: bankName || null,
        bank_account: bankAccount || null,
        note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["withdrawal_requests"] });
    },
  });
}

export function useAdminWalletAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      driverUserId,
      type,
      amount,
      description,
      adminUserId,
    }: {
      driverUserId: string;
      type: "adjustment_add" | "adjustment_subtract" | "bank_transfer" | "withdrawal";
      amount: number;
      description: string;
      adminUserId: string;
    }) => {
      // Ensure wallet exists
      const { data: existingWallet } = await supabase
        .from("driver_wallets")
        .select("id, balance")
        .eq("driver_user_id", driverUserId)
        .maybeSingle();

      let walletId: string;
      let currentBalance: number;

      if (!existingWallet) {
        const { data: newWallet, error: createErr } = await supabase
          .from("driver_wallets")
          .insert({ driver_user_id: driverUserId, balance: 0, total_earned: 0, total_withdrawn: 0 })
          .select()
          .single();
        if (createErr) throw createErr;
        walletId = newWallet.id;
        currentBalance = 0;
      } else {
        walletId = existingWallet.id;
        currentBalance = Number(existingWallet.balance);
      }

      const isAddition = type === "adjustment_add";
      const delta = isAddition ? amount : -amount;
      const newBalance = currentBalance + delta;

      // Update wallet
      const walletUpdate: Record<string, unknown> = { balance: newBalance };
      if (type === "withdrawal" || type === "bank_transfer") {
        walletUpdate.total_withdrawn = supabase.rpc ? undefined : undefined; // handled below
      }

      const { error: updateErr } = await supabase
        .from("driver_wallets")
        .update({
          balance: newBalance,
          ...(type === "withdrawal" || type === "bank_transfer" || type === "adjustment_subtract"
            ? {}
            : {}),
        })
        .eq("id", walletId);
      if (updateErr) throw updateErr;

      // If withdrawal/bank_transfer, update total_withdrawn
      if (type === "withdrawal" || type === "bank_transfer") {
        // We need raw SQL but let's just do a second update
        const { data: wallet } = await supabase
          .from("driver_wallets")
          .select("total_withdrawn")
          .eq("id", walletId)
          .single();
        if (wallet) {
          await supabase
            .from("driver_wallets")
            .update({ total_withdrawn: Number(wallet.total_withdrawn) + amount })
            .eq("id", walletId);
        }
      }

      // Record transaction
      const { error: txErr } = await supabase.from("wallet_transactions").insert({
        wallet_id: walletId,
        driver_user_id: driverUserId,
        type,
        amount,
        balance_after: newBalance,
        description,
        created_by_user_id: adminUserId,
      });
      if (txErr) throw txErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver_wallets"] });
      qc.invalidateQueries({ queryKey: ["driver_wallet"] });
      qc.invalidateQueries({ queryKey: ["wallet_transactions"] });
    },
  });
}

export function useApproveWithdrawal() {
  const qc = useQueryClient();
  const adminAction = useAdminWalletAction();

  return useMutation({
    mutationFn: async ({
      requestId,
      driverUserId,
      amount,
      adminUserId,
      action,
    }: {
      requestId: string;
      driverUserId: string;
      amount: number;
      adminUserId: string;
      action: "approved" | "rejected" | "completed";
    }) => {
      const { error } = await supabase
        .from("withdrawal_requests")
        .update({
          status: action,
          reviewed_by: adminUserId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      if (error) throw error;

      // If completed, deduct from wallet
      if (action === "completed") {
        await adminAction.mutateAsync({
          driverUserId,
          type: "bank_transfer",
          amount,
          description: `Банк руу шилжүүлсэн`,
          adminUserId,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["withdrawal_requests"] });
      qc.invalidateQueries({ queryKey: ["driver_wallets"] });
      qc.invalidateQueries({ queryKey: ["driver_wallet"] });
      qc.invalidateQueries({ queryKey: ["wallet_transactions"] });
    },
  });
}

const TX_TYPE_LABELS: Record<string, string> = {
  delivery_earning: "Хүргэлтийн орлого",
  withdrawal: "Мөнгө татсан",
  adjustment_add: "Нэмэлт",
  adjustment_subtract: "Хасалт",
  bank_transfer: "Банк руу шилжүүлсэн",
};

export { TX_TYPE_LABELS };

const WITHDRAWAL_STATUS_LABELS: Record<string, string> = {
  pending: "Хүлээгдэж буй",
  approved: "Зөвшөөрсөн",
  rejected: "Татгалзсан",
  completed: "Гүйцэтгэсэн",
};

export { WITHDRAWAL_STATUS_LABELS };
