import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { applyStatusUpdateResilient, applyPaymentUpdateResilient } from "@/lib/orderSync";

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
  });
}

export function useDriverOrders(driverId: string, statusFilter?: string) {
  return useQuery({
    queryKey: ["orders", "driver", driverId, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("*, order_items(*)")
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
  });
}

// Fire-and-forget: call webhook-sync edge function (server-side, no client secret exposure)
function fireShopWebhook(orderId: string) {
  supabase.functions.invoke("webhook-sync", {
    body: { order_id: orderId, event_type: "status_changed" },
  }).catch((err) => console.error("Shop webhook invoke failed:", err));
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      status,
      userId,
      paymentCollectedInCash,
    }: {
      orderId: string;
      status: FulfillmentStatus;
      userId: string;
      paymentCollectedInCash?: boolean;
    }) => {
      const updates: {
        fulfillment_status: FulfillmentStatus;
        updated_by_user_id: string;
        phone_confirmed_at?: string;
        out_for_delivery_at?: string;
        delivered_at?: string;
        cancelled_at?: string;
        payment_collected_in_cash?: boolean;
      } = {
        fulfillment_status: status,
        updated_by_user_id: userId,
      };
      if (status === "phone_confirmed") updates.phone_confirmed_at = new Date().toISOString();
      if (status === "out_for_delivery") updates.out_for_delivery_at = new Date().toISOString();
      if (status === "delivered") updates.delivered_at = new Date().toISOString();
      if (status === "cancelled") updates.cancelled_at = new Date().toISOString();
      if (typeof paymentCollectedInCash === "boolean") {
        updates.payment_collected_in_cash = paymentCollectedInCash;
        // If cash was collected on delivery, also mark as paid
        if (paymentCollectedInCash && status === "delivered") {
          (updates as Record<string, unknown>).payment_status = "paid";
        }
      }

      const { error } = await supabase.from("orders").update(updates).eq("id", orderId);
      if (error) throw error;

      // Fire-and-forget: sync status to shop / merchant
      fireShopWebhook(orderId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useAssignDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, driverId, userId }: { orderId: string; driverId: string | null; userId: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ assigned_driver_user_id: driverId, updated_by_user_id: userId })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
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
      const { error } = await supabase
        .from("orders")
        .update({ payment_status: status, updated_by_user_id: userId })
        .eq("id", orderId);
      if (error) throw error;

      // Fire-and-forget: sync status to shop
      fireShopWebhook(orderId);
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
