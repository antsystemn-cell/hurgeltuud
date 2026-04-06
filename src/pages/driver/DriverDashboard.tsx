import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDriverOrders, useUpdateOrderStatus, FULFILLMENT_LABELS, PAYMENT_LABELS } from "@/hooks/useOrders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, MapPin, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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

              {/* Actions */}
              <div className="flex gap-2">
                <a
                  href={`tel:${order.phone}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
                >
                  <Phone className="h-4 w-4" />
                  Залгах
                </a>

                {order.fulfillment_status !== "delivered" && order.fulfillment_status !== "cancelled" && (
                  <>
                    <Button
                      size="lg"
                      className="flex-1 bg-success text-success-foreground hover:bg-success/90"
                      onClick={() => handleMarkDelivered(order.id)}
                      disabled={updateStatus.isPending}
                    >
                      <CheckCircle2 className="h-5 w-5 mr-1" />
                      Хүргэсэн
                    </Button>
                    <Button
                      size="lg"
                      variant="destructive"
                      onClick={() => handleMarkCancelled(order.id)}
                      disabled={updateStatus.isPending}
                    >
                      <XCircle className="h-5 w-5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
