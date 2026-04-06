import { useOrders, FULFILLMENT_LABELS, PAYMENT_LABELS } from "@/hooks/useOrders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, CheckCircle2, XCircle, DollarSign } from "lucide-react";

export default function AdminDashboard() {
  const { data: orders } = useOrders();

  const stats = {
    total: orders?.length || 0,
    active: orders?.filter((o) => ["confirmed", "phone_confirmed", "out_for_delivery"].includes(o.fulfillment_status)).length || 0,
    delivered: orders?.filter((o) => o.fulfillment_status === "delivered").length || 0,
    cancelled: orders?.filter((o) => o.fulfillment_status === "cancelled").length || 0,
    unpaid: orders?.filter((o) => o.payment_status !== "paid").length || 0,
  };

  const todayOrders = orders?.filter((o) => {
    const today = new Date().toISOString().split("T")[0];
    return o.created_at >= today;
  }) || [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <h2 className="text-xl font-semibold text-foreground">Хянах самбар</h2>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Нийт</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <span className="text-2xl font-semibold text-foreground">{stats.total}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Идэвхтэй</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <span className="text-2xl font-semibold text-foreground">{stats.active}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Хүргэсэн</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <span className="text-2xl font-semibold text-foreground">{stats.delivered}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Цуцалсан</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            <span className="text-2xl font-semibold text-foreground">{stats.cancelled}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Төлөгдөөгүй</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-warning" />
            <span className="text-2xl font-semibold text-foreground">{stats.unpaid}</span>
          </CardContent>
        </Card>
      </div>

      {/* Today's orders */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Өнөөдрийн захиалгууд ({todayOrders.length})</h3>
        {todayOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Өнөөдөр захиалга алга</p>
        ) : (
          <div className="space-y-2">
            {todayOrders.slice(0, 10).map((order) => (
              <div key={order.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{order.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{order.internal_order_number} • {order.district}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{FULFILLMENT_LABELS[order.fulfillment_status]}</p>
                  <p className="text-xs text-muted-foreground">{PAYMENT_LABELS[order.payment_status]}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
