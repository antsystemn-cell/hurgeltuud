// Niimbot label data — single source of truth for all export paths
export interface NiimbotLabelData {
  order_no: string;
  customer_name: string;
  phone: string;
  phone2?: string;
  district: string;
  address: string;
  payment_status: string; // localized e.g. "Бэлэн мөнгө", "Төлсөн"
  payment_amount?: string; // formatted, e.g. "₮35,000" — empty if paid
  items: string; // joined "Бараа × 2, Бараа2 × 1"
  tracking_code?: string;
  note?: string;
}
