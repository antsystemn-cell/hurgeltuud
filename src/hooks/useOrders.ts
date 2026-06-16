import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { applyStatusUpdateResilient, applyPaymentUpdateResilient, fireShopWebhook, applyDeliveryOutcome, type DeliveryOutcomeInput } from "@/lib/orderSync";

type Order = Database["public"]["Tables"]["orders"]["Row"];
type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];
type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
type OrderItemInsert = Database["public"]["Tables"]["order_items"]["Insert"];
type FulfillmentStatus = Database["public"]["Enums"]["fulfillment_status"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];

export type { Order, OrderItem, FulfillmentStatus, PaymentStatus };

export const FULFILLMENT_LABELS: Record<FulfillmentStatus, string> = {
  confirmed: "Захиалга баталгаажсан",
  phone_confirmed: "Утсаар баталгаажуулсан",
  out_for_delivery: "Хүргэлтэнд гарсан",
  delivered: "Хүргэгдсэн",
  cancelled: "Цуцлагдсан",
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Төлөгдөөгүй",
  cash_on_delivery: "Бэлнээр",
  paid: "Төлөгдсөн",
  refunded: "Буцаалт",
};

export function useOrders(filters?: {
  fulfillment_status?: FulfillmentStatus;
  driver_id?: string;
  source_system_id?: string;
  merchant_code?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["orders", filters],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("*, order_items(*), source_systems(name, code)")
        .order("created_at", { ascending: false });

      if (filters?.fulfillment_status) {
        q = q.eq("fulfillment_status", filters.fulfillment_status);
      }
      if (filters?.driver_id) {
        q = q.eq("assigned_driver_user_id", filters.driver_id);
      }
      if (filters?.source_system_id) {
        q = q.eq("source_system_id", filters.source_system_id);
      }
      if (filters?.merchant_code) {
        q = q.eq("merchant_code", filters.merchant_code);
      }
      if (filters?.search) {
        q = q.or(
          `customer_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,internal_order_number.ilike.%${filters.search}%,merchant_name.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    staleTime: 10000,
  });
}

// Distinct merchants (shops within source marketplaces) for filtering
export function useMerchants() {
  return useQuery({
    queryKey: ["merchants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("merchant_code, merchant_name")
        .not("merchant_code", "is", null);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of data as Array<{ merchant_code: string | null; merchant_name: string | null }>) {
        if (row.merchant_code && !map.has(row.merchant_code)) {
          map.set(row.merchant_code, row.merchant_name || row.merchant_code);
        }
      }
      return Array.from(map, ([code, name]) => ({ code, name }));
    },
    staleTime: 60000,
  });
}


export function useActiveOrders() {
  return useQuery({
    queryKey: ["orders", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*), source_systems(name, code)")
        .in("fulfillment_status", ["confirmed", "phone_confirmed", "out_for_delivery"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 15000,
  });
}

export function useDriverOrders(driverId: string, statusFilter?: string) {
  return useQuery({
    queryKey: ["orders", "driver", driverId, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("*, order_items(*), source_systems(name, code)")
        .eq("assigned_driver_user_id", driverId)
        .order("created_at", { ascending: false });

      if (statusFilter === "active") {
        q = q.in("fulfillment_status", ["confirmed", "phone_confirmed", "out_for_delivery"]);
      } else if (statusFilter === "delivered") {
        q = q.eq("fulfillment_status", "delivered");
      } else if (statusFilter === "cancelled") {
        q = q.eq("fulfillment_status", "cancelled");
      } else if (statusFilter === "today") {
        const today = new Date().toISOString().split("T")[0];
        q = q.gte("created_at", today);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!driverId,
    staleTime: 15000,
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      status,
      userId,
    }: {
      orderId: string;
      status: FulfillmentStatus;
      userId: string;
    }) => {
      // Double-submit guard + offline queue handled inside the shared helper.
      return await applyStatusUpdateResilient({ orderId, status, userId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export type TelegramNotifyResult = {
  success?: boolean;
  sent?: boolean;
  skipped?: string;
  error?: string;
  driver?: string;
} | null;

export function useAssignDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, driverId, userId }: { orderId: string; driverId: string | null; userId: string }) => {
      const updates: Database["public"]["Tables"]["orders"]["Update"] = {
        assigned_driver_user_id: driverId,
        updated_by_user_id: userId,
      };
      // Stamp assignment time only when an actual driver is assigned (additive, non-breaking).
      if (driverId) updates.assigned_at = new Date().toISOString();

      const { error } = await supabase.from("orders").update(updates).eq("id", orderId);
      if (error) throw error;

      // Fire Telegram notification AFTER successful assignment.
      // A Telegram failure must never roll back or block the assignment.
      let telegram: TelegramNotifyResult = null;
      if (driverId) {
        try {
          const { data, error: fnErr } = await supabase.functions.invoke(
            "send-telegram-delivery-notification",
            { body: { orderId } }
          );
          telegram = fnErr ? { sent: false, error: fnErr.message } : (data as TelegramNotifyResult);
        } catch (e) {
          telegram = { sent: false, error: (e as Error).message };
        }
      }
      return { telegram };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

// Manually (force) resend the Telegram delivery notification for an order.
export function useResendTelegramNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke(
        "send-telegram-delivery-notification",
        { body: { orderId, force: true } }
      );
      if (error) throw error;
      return data as TelegramNotifyResult;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

// Send a one-off test Telegram message to a driver's group chat.
export function useSendTelegramTest() {
  return useMutation({
    mutationFn: async (driverId: string) => {
      const { data, error } = await supabase.functions.invoke("send-telegram-test-message", {
        body: { driverId },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || "Telegram алдаа");
      return data;
    },
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      order,
      items,
    }: {
      order: Omit<OrderInsert, "internal_order_number"> & { internal_order_number?: string };
      items: Omit<OrderItemInsert, "order_id">[];
    }) => {
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({ ...order, internal_order_number: order.internal_order_number || "" })
        .select()
        .single();
      if (orderError) throw orderError;

      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(items.map((item) => ({ ...item, order_id: orderData.id })));
        if (itemsError) throw itemsError;
      }

      return orderData;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useUpdatePaymentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, status, userId }: { orderId: string; status: PaymentStatus; userId: string }) => {
      // Double-submit guard + offline queue handled inside the shared helper.
      return await applyPaymentUpdateResilient({ orderId, status, userId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

// Record a delivery outcome (reason + note + mandatory proof photo) and set the
// resulting fulfillment status in one atomic update.
export function useRecordDeliveryOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeliveryOutcomeInput) => {
      await applyDeliveryOutcome(input);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

// Manually retry a stuck outbound sync for one order (admin action).
export function useManualRetrySync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.functions.invoke("webhook-retry", {
        body: { order_id: orderId },
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}



export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error: itemsErr } = await supabase.from("order_items").delete().eq("order_id", orderId);
      if (itemsErr) throw itemsErr;
      const { error } = await supabase.from("orders").delete().eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useUpdateOrderAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, district, addressText, userId }: { orderId: string; district: string; addressText: string; userId: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ district, address_text: addressText, updated_by_user_id: userId })
        .eq("id", orderId);
      if (error) throw error;
      fireShopWebhook(orderId, "address_changed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useDrivers() {
  return useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      // Use security definer RPC so operators (who can't read user_roles directly) can also load drivers
      const { data, error } = await supabase.rpc("get_drivers_safe");
      if (error) throw error;

      return (data || []).map((p) => ({
        user_id: p.user_id,
        profiles: { full_name: p.full_name, phone: p.phone, active: p.active },
      }));
    },
  });
}

export function useSourceSystems() {
  return useQuery({
    queryKey: ["source_systems"],
    queryFn: async () => {
      // Use security definer RPC to avoid exposing api_key/webhook_secret to operators
      const { data, error } = await supabase.rpc("get_source_systems_safe");
      if (error) throw error;
      return data as Array<{ id: string; name: string; code: string; active: boolean; notes: string | null; created_at: string; updated_at: string }>;
    },
  });
}
