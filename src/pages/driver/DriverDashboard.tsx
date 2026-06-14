import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useDriverOrders, useUpdateOrderStatus, useUpdatePaymentStatus, FULFILLMENT_LABELS, PAYMENT_LABELS } from "@/hooks/useOrders";
import type { Order } from "@/hooks/useOrders";
import { getStoreInfo, resolveDistrict, formatOrderDate } from "@/lib/orderHelpers";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Phone, MapPin, CheckCircle2, XCircle, Banknote, Search, ChevronDown, Store, Package, GripVertical, ArrowUp, ArrowDown, ListOrdered, Check, Navigation, Calendar, MessageSquare, Receipt, CreditCard, Tag, ClipboardCheck } from "lucide-react";
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
import { DeliveryOutcomeDialog } from "@/components/driver/DeliveryOutcomeDialog";
import { DELIVERY_OUTCOME_LABELS } from "@/lib/orderHelpers";
import { ProofImage } from "@/components/driver/ProofImage";

const FILTERS = [
  { key: "active", label: "Идэвхтэй" },
  { key: "delivered", label: "Хүргэсэн" },
  { key: "cancelled", label: "Цуцалсан" },
  { key: "today", label: "Өнөөдөр" },
] as const;

const seqKey = (userId: string) => `driver_delivery_sequence_${userId}`;

// Sort orders by a saved manual sequence of ids. Orders not in the saved list
// keep their original (created_at) order and fall to the bottom. Stable sort.
function mapsUrl(address: string) {
  const query = encodeURIComponent(address);
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}

function sortByManual<T extends { id: string }>(list: T[], manualOrder: string[]): T[] {
  if (!manualOrder.length) return list;
  const pos = new Map(manualOrder.map((id, i) => [id, i]));
  return [...list]
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => {
      const pa = pos.has(a.item.id) ? (pos.get(a.item.id) as number) : Number.MAX_SAFE_INTEGER;
      const pb = pos.has(b.item.id) ? (pos.get(b.item.id) as number) : Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      return a.idx - b.idx;
    })
    .map(({ item }) => item);
}

export default function DriverDashboard() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<string>("active");
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [reorderMode, setReorderMode] = useState(false);
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const [outcomeOrder, setOutcomeOrder] = useState<Order | null>(null);
  const { data: orders, isLoading } = useDriverOrders(user?.id || "", filter);
  const updateStatus = useUpdateOrderStatus();
  const updatePayment = useUpdatePaymentStatus();

  // Load saved sequence for this driver.
  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(seqKey(user.id));
      setManualOrder(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setManualOrder([]);
    }
  }, [user?.id]);

  const persistOrder = useCallback(
    (ids: string[]) => {
      setManualOrder(ids);
      if (user?.id) localStorage.setItem(seqKey(user.id), JSON.stringify(ids));
    },
    [user?.id]
  );

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
    const list = orders.filter((order) => {
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
    return sortByManual(list, manualOrder);
  }, [orders, search, storeFilter, manualOrder]);

  // Reordering is only meaningful for the active delivery list.
  const canReorder = filter === "active" && filteredOrders.length > 1;

  // Leave reorder mode automatically if it no longer applies.
  useEffect(() => {
    if (!canReorder && reorderMode) setReorderMode(false);
  }, [canReorder, reorderMode]);

  const handleMarkPaid = (orderId: string) => {
    if (!user) return;
    updatePayment.mutate({ orderId, status: "paid", userId: user.id });
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-foreground">Миний хүргэлтүүд</h2>
        {canReorder && (
          <button
            onClick={() => setReorderMode((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              reorderMode
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border"
            )}
          >
            {reorderMode ? <Check className="h-3.5 w-3.5" /> : <ListOrdered className="h-3.5 w-3.5" />}
            {reorderMode ? "Дуусгах" : "Дараалал засах"}
          </button>
        )}
      </div>

      {!reorderMode && (
        <>
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

          {canReorder && (
            <p className="text-xs text-muted-foreground">
              💡 Картыг удаан дарж хүргэлтийн дарааллыг өөрчилнө.
            </p>
          )}
        </>
      )}

      {reorderMode ? (
        <ReorderList
          orders={filteredOrders as Order[]}
          onChange={(ids) => persistOrder(ids)}
          onDone={() => setReorderMode(false)}
        />
      ) : isLoading ? (
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
            <LongPressCollapsible
              key={order.id}
              enableLongPress={canReorder}
              onLongPress={() => setReorderMode(true)}
            >
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
                    <a
                      href={mapsUrl([district, order.address_text].filter(Boolean).join(", "))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MapPin className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                      <span className="truncate">
                        {[district, order.address_text].filter(Boolean).join(", ")}
                      </span>
                    </a>
                  )}
                </div>
                <ChevronDown className="chevron h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 mt-0.5" />
              </CollapsibleTrigger>

              <CollapsibleContent className="px-4 pb-4 space-y-3">
                {/* Order meta */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    {order.internal_order_number}
                  </span>
                  {order.external_order_id && (
                    <span className="inline-flex items-center gap-1">
                      <Store className="h-3 w-3" />
                      {order.external_order_id}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {(() => {
                      const d = formatOrderDate(order.created_at);
                      return `${d.day} ${d.month}, ${d.time}`;
                    })()}
                  </span>
                </div>

                {/* Alternate phone */}
                {order.alternate_phone && (
                  <a
                    href={`tel:${order.alternate_phone}`}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>Нэмэлт утас: {order.alternate_phone}</span>
                  </a>
                )}

                {/* Customer note */}
                {order.customer_note && (
                  <div className="flex items-start gap-2 text-sm rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-2.5">
                    <MessageSquare className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground text-xs">Захиалагчийн тэмдэглэл</p>
                      <p className="text-muted-foreground text-sm">{order.customer_note}</p>
                    </div>
                  </div>
                )}

                {/* Full location with note */}
                {(district || order.address_text || order.delivery_note) && (
                  <a
                    href={mapsUrl([district, order.address_text].filter(Boolean).join(", "))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 text-sm rounded-lg bg-secondary/50 p-2.5 hover:bg-secondary/70 transition-colors"
                  >
                    <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <div>
                      {district && <p className="font-medium text-foreground">{district}</p>}
                      {order.address_text && <p className="text-muted-foreground">{order.address_text}</p>}
                      {order.delivery_note && (
                        <p className="text-xs text-muted-foreground mt-1">📝 {order.delivery_note}</p>
                      )}
                    </div>
                  </a>
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
                      {order.order_items.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-foreground">{item.product_name_snapshot}</span>
                            {item.variant_snapshot && (
                              <p className="text-[11px] text-muted-foreground">{item.variant_snapshot}</p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            {item.unit_price ? (
                              <p className="text-[11px] text-muted-foreground">₮{Number(item.unit_price).toLocaleString()}</p>
                            ) : null}
                            <span className="shrink-0 rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                              × {item.quantity}
                            </span>
                            {item.line_total ? (
                              <p className="text-xs font-medium text-foreground mt-0.5">₮{Number(item.line_total).toLocaleString()}</p>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Financial summary */}
                <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Receipt className="h-3.5 w-3.5 text-primary" />
                    Төлбөрийн мэдээлэл
                  </div>
                  {order.subtotal != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Барааны дүн</span>
                      <span className="font-medium text-foreground">₮{Number(order.subtotal).toLocaleString()}</span>
                    </div>
                  )}
                  {order.delivery_fee != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Хүргэлтийн төлбөр</span>
                      <span className="font-medium text-foreground">₮{Number(order.delivery_fee).toLocaleString()}</span>
                    </div>
                  )}
                  {order.payment_method && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Төлбөрийн хэлбэр</span>
                      <span className="font-medium text-foreground">{order.payment_method}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm border-t border-border pt-2">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <CreditCard className="h-3.5 w-3.5" />
                      Төлөв
                    </span>
                    <Badge
                      variant={order.payment_status === "paid" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {PAYMENT_LABELS[order.payment_status]}
                    </Badge>
                  </div>
                  {order.total_amount ? (
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-foreground">Нийт</span>
                      <span className="text-foreground">₮{Number(order.total_amount).toLocaleString()}</span>
                    </div>
                  ) : null}
                  {order.payment_status === "paid" && (
                    <p className="text-[11px] text-muted-foreground">✓ Жолооч баталсан</p>
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

                {/* Fulfillment action — opens the outcome dialog (reason + note + photo) */}
                {order.fulfillment_status !== "delivered" && order.fulfillment_status !== "cancelled" && (
                  <button
                    onClick={() => setOutcomeOrder(order)}
                    disabled={updateStatus.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                  >
                    <ClipboardCheck className="h-5 w-5" />
                    Хүргэлтийн үр дүн бүртгэх
                  </button>
                )}

                {/* Recorded outcome (for finished orders) */}
                {order.delivery_outcome && (
                  <div
                    className={cn(
                      "rounded-lg border p-3 space-y-2",
                      order.fulfillment_status === "delivered"
                        ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
                        : "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                    )}
                  >
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      {order.fulfillment_status === "delivered" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      {DELIVERY_OUTCOME_LABELS[order.delivery_outcome] || order.delivery_outcome}
                    </p>
                    {order.delivery_outcome_note && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.delivery_outcome_note}</p>
                    )}
                    {order.delivery_proof_url && (
                      <ProofImage
                        path={order.delivery_proof_url}
                        className="w-full max-h-56 object-cover rounded-md border border-border"
                      />
                    )}
                  </div>
                )}
              </CollapsibleContent>
            </LongPressCollapsible>
            );
          })}
        </div>
      )}

      {outcomeOrder && (
        <DeliveryOutcomeDialog
          order={outcomeOrder}
          open={!!outcomeOrder}
          onOpenChange={(open) => {
            if (!open) setOutcomeOrder(null);
          }}
        />
      )}
    </div>
  );
}

// Wraps a Collapsible and detects a long press (~500ms) to trigger reorder mode.
function LongPressCollapsible({
  children,
  enableLongPress,
  onLongPress,
}: {
  children: React.ReactNode;
  enableLongPress: boolean;
  onLongPress: () => void;
}) {
  const timer = useRef<number>();
  const triggered = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const start = (e: React.PointerEvent) => {
    if (!enableLongPress) return;
    triggered.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    timer.current = window.setTimeout(() => {
      triggered.current = true;
      onLongPress();
    }, 500);
  };
  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current);
    startPos.current = null;
  };
  // Only cancel if the finger/pointer actually moves (scroll), not on micro-jitter.
  const maybeCancel = (e: React.PointerEvent) => {
    if (!startPos.current) return;
    const dx = Math.abs(e.clientX - startPos.current.x);
    const dy = Math.abs(e.clientY - startPos.current.y);
    if (dx > 10 || dy > 10) cancel();
  };

  return (
    <Collapsible
      className="bg-card border border-border rounded-xl"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onPointerMove={maybeCancel}
      onClickCapture={(e) => {
        // Swallow the click that ends a long press so the card doesn't toggle.
        if (triggered.current) {
          e.preventDefault();
          e.stopPropagation();
          triggered.current = false;
        }
      }}
    >
      {children}
    </Collapsible>
  );
}

// Touch/pointer friendly drag-to-reorder list used in reorder mode.
function ReorderList({
  orders,
  onChange,
  onDone,
}: {
  orders: Order[];
  onChange: (ids: string[]) => void;
  onDone: () => void;
}) {
  const [items, setItems] = useState<Order[]>(orders);
  const dragIndex = useRef<number | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems(orders);
  }, [orders]);

  const commit = (next: Order[]) => {
    setItems(next);
    onChange(next.map((o) => o.id));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    commit(next);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragIndex.current == null || !containerRef.current) return;
    const cards = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>("[data-reorder-card]")
    );
    const y = e.clientY;
    let target = dragIndex.current;
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (y < mid) {
        target = i;
        break;
      }
      target = i;
    }
    if (target !== dragIndex.current) {
      move(dragIndex.current, target);
      dragIndex.current = target;
    }
  };

  const endDrag = () => {
    dragIndex.current = null;
    setDragId(null);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-xs text-foreground">
        Бариулаас чирэх эсвэл ↑ ↓ товчоор хүргэлтийн дарааллыг өөрчилнө. Дууссаны дараа “Дуусгах” дарна уу.
      </div>
      <div ref={containerRef} className="space-y-2">
        {items.map((order, index) => {
          const district = resolveDistrict(order);
          return (
            <div
              key={order.id}
              data-reorder-card
              className={cn(
                "flex items-center gap-2 rounded-xl border bg-card p-2.5 transition-shadow select-none",
                dragId === order.id ? "border-primary shadow-lg ring-2 ring-primary/30" : "border-border"
              )}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{order.customer_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[district, order.address_text].filter(Boolean).join(", ") || order.phone}
                </p>
              </div>
              <div className="flex flex-col">
                <button
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0}
                  className="p-1 text-muted-foreground disabled:opacity-30"
                  aria-label="Дээш"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => move(index, index + 1)}
                  disabled={index === items.length - 1}
                  className="p-1 text-muted-foreground disabled:opacity-30"
                  aria-label="Доош"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
              <button
                className="p-1.5 text-muted-foreground touch-none cursor-grab active:cursor-grabbing"
                aria-label="Чирэх"
                onPointerDown={(e) => {
                  e.preventDefault();
                  dragIndex.current = index;
                  setDragId(order.id);
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                }}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <GripVertical className="h-5 w-5" />
              </button>
            </div>
          );
        })}
      </div>
      <button
        onClick={onDone}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
      >
        <Check className="h-4 w-4" />
        Дуусгах
      </button>
    </div>
  );
}
