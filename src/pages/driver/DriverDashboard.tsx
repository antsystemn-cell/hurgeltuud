import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useDriverOrders, useUpdateOrderStatus, useUpdatePaymentStatus, FULFILLMENT_LABELS, PAYMENT_LABELS } from "@/hooks/useOrders";
import { getStoreInfo, resolveDistrict } from "@/lib/orderHelpers";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Phone, MapPin, CheckCircle2, XCircle, Banknote, Search, ChevronDown, Store, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const FILTERS = [
  { key: "active", label: "Идэвхтэй" },
  { key: "delivered", label: "Хүргэсэн" },
  { key: "cancelled", label: "Цуцалсан" },
  { key: "today", label: "Өнөөдөр" },
] as const;

export default function DriverDashboard() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<string>("active");
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const { data: orders, isLoading } = useDriverOrders(user?.id || "", filter);
  const updateStatus = useUpdateOrderStatus();
  const updatePayment = useUpdatePaymentStatus();

  // Distinct stores present in the loaded orders (for the store filter chips)
  const stores = useMemo(() => {
    if (!orders) return [];
    const map = new Map<string, { key: string; name: string; count: number }>();
    for (const order of orders) {
      const info = getStoreInfo(order);
      const existing = map.get(info.key);
      if (existing) existing.count += 1;
      else map.set(info.key, { key: info.key, name: info.name, count: 1 });
    }
    return Array.from(map.values());
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (storeFilter !== "all" && getStoreInfo(order).key !== storeFilter) return false;
      if (!term) return true;
      const haystack = [
        order.customer_name,
        order.phone,
        order.internal_order_number,
        order.district,
        order.address_text,
        order.delivery_note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [orders, search, storeFilter]);

  const handleMarkPaid = (orderId: string) => {
    if (!user) return;
    updatePayment.mutate({ orderId, status: "paid", userId: user.id });
  };
  const handleMarkDelivered = (orderId: string) => {
    if (!user) return;
    updateStatus.mutate({ orderId, status: "delivered", userId: user.id });
  };

  const handleMarkCancelled = (orderId: string) => {
    if (!user) return;
    updateStatus.mutate({ orderId, status: "cancelled", userId: user.id });
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Миний хүргэлтүүд</h2>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Нэр, утас, хаягаар хайх..."
          className="pl-9"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors",
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Store filter */}
      {stores.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
          <button
            onClick={() => setStoreFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors",
              storeFilter === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border"
            )}
          >
            Бүх дэлгүүр
          </button>
          {stores.map((s) => (
            <button
              key={s.key}
              onClick={() => setStoreFilter(s.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors",
                storeFilter === s.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border"
              )}
            >
              {s.name} <span className="opacity-70">({s.count})</span>
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Уншиж байна...</div>
      ) : !filteredOrders.length ? (
        <div className="text-center py-8 text-muted-foreground">
          {search.trim() ? "Хайлтад тохирох захиалга олдсонгүй" : "Захиалга олдсонгүй"}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order, index) => {
            const store = getStoreInfo(order);
            const district = resolveDistrict(order);
            return (
            <Collapsible key={order.id} className="bg-card border border-border rounded-xl">
              {/* Compact summary row — always visible, click to expand */}
              <CollapsibleTrigger className="w-full p-4 flex items-start gap-3 text-left [&[data-state=open]>svg.chevron]:rotate-180">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground truncate">{order.customer_name}</p>
                    <Badge
                      variant={
                        order.fulfillment_status === "delivered" ? "default" :
                        order.fulfillment_status === "cancelled" ? "destructive" : "secondary"
                      }
                      className="text-xs shrink-0"
                    >
                      {FULFILLMENT_LABELS[order.fulfillment_status]}
                    </Badge>
                  </div>
                  {/* Store badge */}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                      store.badgeClass
                    )}
                  >
                    <Store className="h-3 w-3" />
                    {store.name}
                  </span>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {order.phone}
                  </p>
                  {(district || order.address_text) && (
                    <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                      <span className="truncate">
                        {[district, order.address_text].filter(Boolean).join(", ")}
                      </span>
                    </p>
                  )}
                </div>
                <ChevronDown className="chevron h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 mt-0.5" />
              </CollapsibleTrigger>

              <CollapsibleContent className="px-4 pb-4 space-y-3">
                {/* Order number */}
                <p className="text-xs text-muted-foreground">{order.internal_order_number}</p>

                {/* Full location with note */}
                {(district || order.address_text || order.delivery_note) && (
                  <div className="flex items-start gap-2 text-sm rounded-lg bg-secondary/50 p-2.5">
                    <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <div>
                      {district && <p className="font-medium text-foreground">{district}</p>}
                      {order.address_text && <p className="text-muted-foreground">{order.address_text}</p>}
                      {order.delivery_note && (
                        <p className="text-xs text-muted-foreground mt-1">📝 {order.delivery_note}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Items */}
                {order.order_items && order.order_items.length > 0 && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
                    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-primary/15 bg-primary/10">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-foreground">Захиалсан бараа</span>
                      <span className="ml-auto text-[11px] font-medium text-primary">
                        {order.order_items.length} төрөл
                      </span>
                    </div>
                    <ul className="divide-y divide-primary/10">
                      {order.order_items.map((item: { id: string; product_name_snapshot: string; quantity: number }) => (
                        <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="text-sm font-medium text-foreground">{item.product_name_snapshot}</span>
                          <span className="shrink-0 rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                            × {item.quantity}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Payment status badge */}
                <div className="flex items-center gap-2">
                  <span className="text-sm">💰</span>
                  <Badge
                    variant={order.payment_status === "paid" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {PAYMENT_LABELS[order.payment_status]}
                  </Badge>
                  {order.total_amount ? (
                    <span className="text-sm font-medium text-foreground">₮{Number(order.total_amount).toLocaleString()}</span>
                  ) : null}
                  {order.payment_status === "paid" && (
                    <span className="text-[10px] text-muted-foreground">✓ Жолооч баталсан</span>
                  )}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Call button */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
                        <Phone className="h-4 w-4" />
                        <span className="text-xs">Залгах</span>
                        <span className="text-[10px] opacity-80 leading-tight">{order.phone}</span>
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Залгах уу?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {order.customer_name} — {order.phone} руу залгах гэж байна.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Үгүй</AlertDialogCancel>
                        <AlertDialogAction asChild>
                          <a href={`tel:${order.phone}`}>Тийм</a>
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {/* Payment collected button */}
                  {order.payment_status !== "paid" ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          className="flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-medium disabled:opacity-50"
                          disabled={updatePayment.isPending}
                        >
                          <Banknote className="h-5 w-5" />
                          <span className="text-xs">Төлбөр авсан</span>
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Төлбөр төлүүлсэн үү?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {order.customer_name} — ₮{Number(order.total_amount || 0).toLocaleString()} төлбөр авсан гэж тэмдэглэнэ. Итгэлтэй байна уу?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Үгүй</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleMarkPaid(order.id)}>Тийм</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <div />
                  )}
                </div>

                {/* Fulfillment actions */}
                {order.fulfillment_status !== "delivered" && order.fulfillment_status !== "cancelled" && (
                  <div className="grid grid-cols-2 gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          className="flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
                          disabled={updateStatus.isPending}
                        >
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="text-xs">Хүргэсэн</span>
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Хүргэсэн гэж тэмдэглэх үү?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {order.customer_name} — {order.internal_order_number} захиалгыг хүргэсэн гэж тэмдэглэнэ.
                            Төлбөр энэ үйлдлээр өөрчлөгдөхгүй — төлбөрийг тусдаа "Төлбөр авсан" товчоор баталгаажуулна.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Үгүй</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleMarkDelivered(order.id)}>Тийм</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          className="flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium disabled:opacity-50"
                          disabled={updateStatus.isPending}
                        >
                          <XCircle className="h-5 w-5" />
                          <span className="text-xs">Цуцлах</span>
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Цуцлах уу?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {order.customer_name} — {order.internal_order_number} захиалгыг цуцлах гэж байна.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Үгүй</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleMarkCancelled(order.id)}
                          >
                            Тийм
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
