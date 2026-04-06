import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDriverOrders, useUpdateOrderStatus, FULFILLMENT_LABELS, PAYMENT_LABELS } from "@/hooks/useOrders";
import { Badge } from "@/components/ui/badge";
import { Phone, MapPin, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const { data: orders, isLoading } = useDriverOrders(user?.id || "", filter);
  const updateStatus = useUpdateOrderStatus();

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

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Уншиж байна...</div>
      ) : !orders?.length ? (
        <div className="text-center py-8 text-muted-foreground">Захиалга олдсонгүй</div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-foreground">{order.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{order.internal_order_number}</p>
                </div>
                <Badge
                  variant={
                    order.fulfillment_status === "delivered" ? "default" :
                    order.fulfillment_status === "cancelled" ? "destructive" : "secondary"
                  }
                  className="text-xs"
                >
                  {FULFILLMENT_LABELS[order.fulfillment_status]}
                </Badge>
              </div>

              {/* Location */}
              {order.district && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">{order.district}</p>
                    {order.address_text && <p className="text-muted-foreground">{order.address_text}</p>}
                  </div>
                </div>
              )}

              {/* Items */}
              {order.order_items && order.order_items.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {order.order_items.map((item: { id: string; product_name_snapshot: string; quantity: number }) => (
                    <p key={item.id}>{item.product_name_snapshot} × {item.quantity}</p>
                  ))}
                </div>
              )}

              {/* Payment note */}
              {order.payment_status !== "paid" && (
                <p className="text-sm font-medium text-warning">
                  💰 {PAYMENT_LABELS[order.payment_status]}
                  {order.total_amount ? ` — ₮${Number(order.total_amount).toLocaleString()}` : ""}
                </p>
              )}

              {/* Actions - 3 buttons in a row */}
              <div className="grid grid-cols-3 gap-2">
                {/* Call button with confirmation */}
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

                {order.fulfillment_status !== "delivered" && order.fulfillment_status !== "cancelled" ? (
                  <>
                    {/* Delivered button with confirmation */}
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
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Үгүй</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleMarkDelivered(order.id)}>Тийм</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {/* Cancelled button with confirmation */}
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
                  </>
                ) : (
                  <div className="col-span-2" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
