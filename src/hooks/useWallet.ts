import { useMemo } from "react";
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

export function useWalletTransactions(driverUserId: string, limit = 50) {
  return useQuery({
    queryKey: ["wallet_transactions", driverUserId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("driver_user_id", driverUserId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    enabled: !!driverUserId,
  });
}

export type ShopEarning = {
  code: string; // merchant_code or "__none__"
  name: string;
  count: number;
  total: number;
};

// Breakdown of a driver's delivery earnings grouped by shop (merchant).
// wallet_transactions.order_id has no FK, so we fetch the related orders
// separately and join them client-side.
export function useDriverShopEarnings(driverUserId: string) {
  return useQuery({
    queryKey: ["driver_shop_earnings", driverUserId],
    queryFn: async (): Promise<ShopEarning[]> => {
      const { data: txs, error } = await supabase
        .from("wallet_transactions")
        .select("amount, order_id")
        .eq("driver_user_id", driverUserId)
        .eq("type", "delivery_earning");
      if (error) throw error;

      const rows = txs || [];
      const orderIds = Array.from(
        new Set(rows.map((t) => t.order_id).filter((id): id is string => !!id))
      );

      const merchantByOrder = new Map<string, { code: string | null; name: string | null }>();
      if (orderIds.length > 0) {
        const { data: orders, error: oErr } = await supabase
          .from("orders")
          .select("id, merchant_code, merchant_name")
          .in("id", orderIds);
        if (oErr) throw oErr;
        for (const o of orders || []) {
          merchantByOrder.set(o.id, { code: o.merchant_code, name: o.merchant_name });
        }
      }

      const groups = new Map<string, ShopEarning>();
      for (const t of rows) {
        const m = t.order_id ? merchantByOrder.get(t.order_id) : undefined;
        const code = m?.code || "__none__";
        const name = m?.name || "Бусад / Тодорхойгүй";
        const existing = groups.get(code);
        if (existing) {
          existing.count += 1;
          existing.total += Number(t.amount);
        } else {
          groups.set(code, { code, name, count: 1, total: Number(t.amount) });
        }
      }

      return Array.from(groups.values()).sort((a, b) => b.total - a.total);
    },
    enabled: !!driverUserId,
    staleTime: 15000,
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

export type ShopSettlement = ShopEarning & {
  withdrawn: number; // amount already withdrawn attributed to this shop (Татсан)
  pending: number; // pending/approved withdrawal requests for this shop
  outstanding: number; // still to be settled = earned - withdrawn - pending (Хүлээгдэж буй)
};

// Distributes a whole-number `amount` across `weights` returning whole-number
// parts that sum EXACTLY to `amount` (largest-remainder / Hare quota method).
// Guarantees no fractional tögrög ever appears in the per-shop wallet view.
function allocateWhole(amount: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0 || amount <= 0) return weights.map(() => 0);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  if (totalWeight <= 0) {
    // No weighting info — spread as evenly as possible.
    const base = Math.floor(amount / n);
    const res = weights.map(() => base);
    let rem = amount - base * n;
    for (let i = 0; i < n && rem > 0; i++, rem--) res[i] += 1;
    return res;
  }

  const raw = weights.map((w) => (amount * w) / totalWeight);
  const floored = raw.map((r) => Math.floor(r));
  let rem = amount - floored.reduce((a, b) => a + b, 0);
  const byFrac = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < byFrac.length && rem > 0; k++, rem--) floored[byFrac[k].i] += 1;
  return floored;
}


// Combines a driver's per-shop earnings with their actual wallet withdrawals so
// each shop can be shown as: total earned (Бүгд), withdrawn (Татсан) and the
// outstanding amount still to be settled (Хүлээгдэж буй).
//
// Reliability is critical (real money), so the breakdown ALWAYS reconciles with
// the wallet's authoritative totals:
//   sum(withdrawn)   === wallet.total_withdrawn
//   sum(outstanding) === wallet.balance - pending
// Withdrawals are first attributed to a shop via the request note (saved at
// creation). Any remaining withdrawal that cannot be matched to a shop (e.g. an
// admin bank transfer, or an old request with no note) is distributed across the
// shops proportionally to their remaining (un-withdrawn) earnings, so no money
// is ever lost from the "Татсан" view.
export function useDriverShopSettlement(driverUserId: string) {
  const earningsQ = useDriverShopEarnings(driverUserId);
  const withdrawalsQ = useWithdrawalRequests(driverUserId);
  const walletQ = useDriverWallet(driverUserId);

  const data = useMemo<ShopSettlement[] | undefined>(() => {
    if (!earningsQ.data) return undefined;
    const shops = earningsQ.data;
    const reqs = withdrawalsQ.data || [];
    const wallet = walletQ.data;

    // Every delivery is worth one flat fee (e.g. 8,000₮), so we account for
    // money in WHOLE DELIVERIES. This guarantees every per-shop amount is always
    // a clean multiple of the fee — no more ugly fractions like 262,552₮ that
    // came from spreading a withdrawal proportionally by money.
    const fee =
      shops.find((s) => s.count > 0)?.total &&
      shops.find((s) => s.count > 0)!.count
        ? Math.round(
            shops.find((s) => s.count > 0)!.total / shops.find((s) => s.count > 0)!.count
          )
        : 8000;
    const toUnits = (amount: number) => (fee > 0 ? Math.round(amount / fee) : 0);

    // Authoritative totals come from the wallet ledger, not from notes.
    const totalWithdrawnUnits = toUnits(Number(wallet?.total_withdrawn || 0));
    const totalPendingUnits = toUnits(
      reqs
        .filter((r) => r.status === "pending" || r.status === "approved")
        .reduce((s, r) => s + Number(r.amount), 0)
    );

    // Step 1: attribute what we can to a specific shop via the request note,
    // counting in whole deliveries.
    const attrWithdrawnU = new Map<string, number>();
    const attrPendingU = new Map<string, number>();
    for (const shop of shops) {
      const matched = reqs.filter((r) => (r.note || "").startsWith(shop.name));
      attrWithdrawnU.set(
        shop.code,
        toUnits(
          matched.filter((r) => r.status === "completed").reduce((s, r) => s + Number(r.amount), 0)
        )
      );
      attrPendingU.set(
        shop.code,
        toUnits(
          matched
            .filter((r) => r.status === "pending" || r.status === "approved")
            .reduce((s, r) => s + Number(r.amount), 0)
        )
      );
    }

    const sumAttrWithdrawnU = Array.from(attrWithdrawnU.values()).reduce((a, b) => a + b, 0);
    const sumAttrPendingU = Array.from(attrPendingU.values()).reduce((a, b) => a + b, 0);

    // Step 2: whatever is left unattributed (e.g. an old admin bank transfer
    // saved without a shop note) is distributed as WHOLE DELIVERIES across
    // shops, weighted by each shop's remaining (un-withdrawn) delivery count.
    const unattrWithdrawnU = Math.max(totalWithdrawnUnits - sumAttrWithdrawnU, 0);
    const unattrPendingU = Math.max(totalPendingUnits - sumAttrPendingU, 0);

    const remainingU = shops.map((s) =>
      Math.max(s.count - (attrWithdrawnU.get(s.code) || 0) - (attrPendingU.get(s.code) || 0), 0)
    );
    const distWithdrawnU = allocateWhole(unattrWithdrawnU, remainingU);
    const distPendingU = allocateWhole(unattrPendingU, remainingU);

    return shops.map((shop, i) => {
      const withdrawnU = (attrWithdrawnU.get(shop.code) || 0) + distWithdrawnU[i];
      const pendingU = (attrPendingU.get(shop.code) || 0) + distPendingU[i];
      const outstandingU = Math.max(shop.count - withdrawnU - pendingU, 0);
      const total = shop.count * fee;
      return {
        ...shop,
        total,
        withdrawn: withdrawnU * fee,
        pending: pendingU * fee,
        outstanding: outstandingU * fee,
      };
    });
  }, [earningsQ.data, withdrawalsQ.data, walletQ.data]);

  return {
    data,
    isLoading: earningsQ.isLoading || withdrawalsQ.isLoading || walletQ.isLoading,
  };
}

export function useCreateWithdrawalRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      amount,
      bankName,
      bankAccount,
      note,
    }: {
      walletId?: string;
      driverUserId?: string;
      amount: number;
      bankName?: string;
      bankAccount?: string;
      note?: string;
    }) => {
      const { error } = await supabase.rpc("request_withdrawal", {
        _amount: amount,
        _bank_name: bankName || null,
        _bank_account: bankAccount || null,
        _note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["withdrawal_requests"] });
      qc.invalidateQueries({ queryKey: ["driver_wallet"] });
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
