import type { FulfillmentStatus } from "@/hooks/useOrders";

export const STATUS_BORDER_COLORS: Record<FulfillmentStatus, string> = {
  confirmed: "border-l-blue-500",
  phone_confirmed: "border-l-amber-500",
  out_for_delivery: "border-l-orange-500",
  delivered: "border-l-green-500",
  cancelled: "border-l-red-500",
};

export const STATUS_BG_COLORS: Record<FulfillmentStatus, string> = {
  confirmed: "bg-blue-50 dark:bg-blue-950/20",
  phone_confirmed: "bg-amber-50 dark:bg-amber-950/20",
  out_for_delivery: "bg-orange-50 dark:bg-orange-950/20",
  delivered: "bg-green-50 dark:bg-green-950/20",
  cancelled: "bg-red-50 dark:bg-red-950/20",
};

export function formatOrderDate(dateStr: string): { day: string; month: string; time: string } {
  const d = new Date(dateStr);
  const months = ["1-р сар","2-р сар","3-р сар","4-р сар","5-р сар","6-р сар","7-р сар","8-р сар","9-р сар","10-р сар","11-р сар","12-р сар"];
  return {
    day: d.getDate().toString(),
    month: months[d.getMonth()],
    time: d.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit", hour12: false }),
  };
}
