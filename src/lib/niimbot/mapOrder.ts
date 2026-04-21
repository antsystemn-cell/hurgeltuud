import { PAYMENT_LABELS } from "@/hooks/useOrders";
import type { NiimbotLabelData } from "./types";

type OrderLike = {
  internal_order_number: string;
  customer_name: string;
  phone: string;
  alternate_phone?: string | null;
  district?: string | null;
  address_text?: string | null;
  payment_status: keyof typeof PAYMENT_LABELS;
  total_amount?: number | string | null;
  delivery_note?: string | null;
  customer_note?: string | null;
  external_order_id?: string | null;
  order_items?: Array<{ product_name_snapshot: string; quantity: number }> | null;
};

export function mapOrderToLabelData(order: OrderLike): NiimbotLabelData {
  const items =
    order.order_items
      ?.map((i) => `${i.product_name_snapshot} × ${i.quantity}`)
      .join(", ") ?? "";

  const isPaid = order.payment_status === "paid";
  const amount = order.total_amount ? Number(order.total_amount) : 0;

  return {
    order_no: order.internal_order_number,
    customer_name: order.customer_name,
    phone: order.phone,
    phone2: order.alternate_phone ?? undefined,
    district: order.district ?? "",
    address: order.address_text ?? "",
    payment_status: PAYMENT_LABELS[order.payment_status],
    payment_amount: !isPaid && amount ? `₮${amount.toLocaleString()}` : undefined,
    items,
    tracking_code: order.external_order_id ?? undefined,
    note: order.delivery_note ?? order.customer_note ?? undefined,
  };
}
