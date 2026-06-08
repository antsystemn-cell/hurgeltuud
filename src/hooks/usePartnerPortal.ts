import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// All partner-portal calls go through a single edge function, scoped server-side
// to the source system bound to the token.
async function callPortal<T = any>(token: string, action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("partner-portal", {
    body: { token, action, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function usePortalSession(token: string) {
  return useQuery({
    queryKey: ["portal", "session", token],
    queryFn: () => callPortal(token, "session_info"),
    enabled: !!token,
    retry: false,
  });
}

export function usePortalOrders(token: string, filters: { status?: string; search?: string }) {
  return useQuery({
    queryKey: ["portal", "orders", token, filters],
    queryFn: async () => {
      const res = await callPortal<{ orders: any[] }>(token, "list_orders", {
        status: filters.status && filters.status !== "all" ? filters.status : undefined,
        search: filters.search || undefined,
      });
      return res.orders || [];
    },
    enabled: !!token,
  });
}

export function usePortalDrivers(token: string) {
  return useQuery({
    queryKey: ["portal", "drivers", token],
    queryFn: async () => {
      const res = await callPortal<{ drivers: any[] }>(token, "list_drivers");
      return res.drivers || [];
    },
    enabled: !!token,
  });
}

function usePortalMutation(token: string, action: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => callPortal(token, action, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal", "orders", token] }),
  });
}

export function usePortalAssignDriver(token: string) {
  return usePortalMutation(token, "assign_driver");
}
export function usePortalUpdateFulfillment(token: string) {
  return usePortalMutation(token, "update_fulfillment");
}
export function usePortalUpdatePayment(token: string) {
  return usePortalMutation(token, "update_payment");
}
export function usePortalUpdateAddress(token: string) {
  return usePortalMutation(token, "update_address");
}
