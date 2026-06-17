import type { FulfillmentStatus } from "@/hooks/useOrders";

// ---- Delivery outcomes ----
// When a driver finishes an order they must pick exactly one outcome, write a
// clear note and attach a mandatory proof photo. Each outcome maps to either a
// "delivered" or "cancelled" fulfillment status.
export type DeliveryOutcomeKind = "delivered" | "cancelled";

export type DeliveryOutcomeDef = {
  code: string;
  label: string;
  kind: DeliveryOutcomeKind;
};

export const DELIVERY_OUTCOMES: DeliveryOutcomeDef[] = [
  { code: "handed_to_customer", label: "Хэрэглэгчид биеэр гардуулсан", kind: "delivered" },
  { code: "local_vehicle", label: "Орон нутгийн машинд тавьсан", kind: "delivered" },
  { code: "left_at_shop", label: "Гэрийн доод талын дэлгүүрт үлдээсэн", kind: "delivered" },
  { code: "no_answer", label: "Утсаа аваагүй тул буцаасан", kind: "cancelled" },
  { code: "no_response", label: "Хариу өгөөгүй тул буцаасан", kind: "cancelled" },
  { code: "customer_refused", label: "Хэрэглэгч авахгүй тул буцаасан", kind: "cancelled" },
  { code: "exchange_requested", label: "Хэрэглэгч солиулах хүсэлт гаргасан", kind: "cancelled" },
];

export const DELIVERY_OUTCOME_LABELS: Record<string, string> = Object.fromEntries(
  DELIVERY_OUTCOMES.map((o) => [o.code, o.label])
);

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

// ---- Store (source system) badge styling ----
export type StoreInfo = { key: string; name: string; badgeClass: string };

const STORE_STYLES: Record<string, string> = {
  shop_only_mn: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  easyshop_mn: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900",
  only_merchants_hub: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
};

const UNKNOWN_STORE_STYLE = "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700";

type StoreOrder = {
  source_system_id?: string | null;
  merchant_name?: string | null;
  source_systems?: { name?: string | null; code?: string | null } | null;
};

// Derives the store a delivery belongs to. Prefers merchant name, falls back to source system.
export function getStoreInfo(order: StoreOrder): StoreInfo {
  const code = order.source_systems?.code || order.source_system_id || "unknown";
  const sourceName = order.source_systems?.name || "EasyShop";
  const name = order.merchant_name?.trim() || sourceName;
  const badgeClass = STORE_STYLES[order.source_systems?.code || ""] || UNKNOWN_STORE_STYLE;
  return { key: code, name, badgeClass };
}

// ---- District auto-detection ----
// EasyShop (and some sources) push the district inside the free-text address
// instead of the dedicated `district` column. We detect it for display so every
// order shows which district it belongs to. Boundaries handle both Cyrillic & Latin.
const DISTRICT_PATTERNS: { code: string; tokens: string[] }[] = [
  { code: "БЗД", tokens: ["бзд", "bzd", "баянзүрх", "bayanzurkh", "bayanzurh"] },
  { code: "БГД", tokens: ["бгд", "bgd", "баянгол", "bayangol"] },
  { code: "СХД", tokens: ["схд", "shd", "sxd", "сонгино", "songino"] },
  { code: "ЧД", tokens: ["чд", "chd", "чингэлтэй", "chingeltei"] },
  { code: "ХУД", tokens: ["худ", "hud", "xud", "хан-уул", "хануул", "khan-uul", "khan uul"] },
  { code: "НД", tokens: ["нд", "nd", "налайх", "nalaikh", "nalaih"] },
];

export function detectDistrict(address?: string | null): string | null {
  if (!address) return null;
  for (const { code, tokens } of DISTRICT_PATTERNS) {
    const re = new RegExp(`(^|[^a-zа-яё])(${tokens.join("|")})([^a-zа-яё]|$)`, "i");
    if (re.test(address)) return code;
  }
  return null;
}

// Returns the explicit district, falling back to one detected from the address.
export function resolveDistrict(order: { district?: string | null; address_text?: string | null }): string | null {
  return order.district?.trim() || detectDistrict(order.address_text);
}

export function formatOrderDate(dateStr: string): { day: string; month: string; time: string } {
  const d = new Date(dateStr);
  const months = ["1-р сар","2-р сар","3-р сар","4-р сар","5-р сар","6-р сар","7-р сар","8-р сар","9-р сар","10-р сар","11-р сар","12-р сар"];
  return {
    day: d.getDate().toString(),
    month: months[d.getMonth()],
    time: d.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit", hour12: false }),
  };
}
