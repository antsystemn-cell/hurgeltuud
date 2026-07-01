import OrderList from "@/pages/shared/OrderList";

// Delivery management scoped to a single source system: Only Shop (shop_only_mn).
// Reuses the full OrderList management UI but hard-filters to Only Shop orders.
export default function ShopOnlyDelivery() {
  return <OrderList lockedSourceCode="shop_only_mn" title="Only Shop — Хүргэлт удирдах" />;
}
