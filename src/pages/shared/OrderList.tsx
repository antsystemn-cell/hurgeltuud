import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useOrders, useDrivers, useSourceSystems, useUpdateOrderStatus, useAssignDriver, useUpdatePaymentStatus, useDeleteOrder, FULFILLMENT_LABELS, PAYMENT_LABELS, type FulfillmentStatus, type PaymentStatus } from "@/hooks/useOrders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, Phone, Trash2 } from "lucide-react";

export default function OrderList() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [driverFilter, setDriverFilter] = useState<string>("all");

  const { data: orders, isLoading } = useOrders({
    fulfillment_status: statusFilter !== "all" ? statusFilter as FulfillmentStatus : undefined,
    source_system_id: sourceFilter !== "all" ? sourceFilter : undefined,
    driver_id: driverFilter !== "all" ? driverFilter : undefined,
    search: search || undefined,
  });
  const { data: drivers } = useDrivers();
  const { data: sources } = useSourceSystems();
  const updateStatus = useUpdateOrderStatus();
  const assignDriver = useAssignDriver();
  const updatePayment = useUpdatePaymentStatus();
  const deleteOrder = useDeleteOrder();

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <h2 className="text-xl font-semibold text-foreground">Бүх захиалгууд</h2>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Хайх..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Статус" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүх статус</SelectItem>
            {Object.entries(FULFILLMENT_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Эх сайт" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүх сайт</SelectItem>
            {sources?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={driverFilter} onValueChange={setDriverFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Жолооч" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүх жолооч</SelectItem>
            {drivers?.map((d) => (
              <SelectItem key={d.user_id} value={d.user_id}>
                {(d.profiles as unknown as { full_name: string }).full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Уншиж байна...</div>
      ) : !orders?.length ? (
        <div className="text-center py-8 text-muted-foreground">Захиалга олдсонгүй</div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <div key={order.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{order.customer_name}</p>
                    <a href={`tel:${order.phone}`} className="text-primary"><Phone className="h-4 w-4" /></a>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {order.internal_order_number}
                    {order.source_systems && ` • ${(order.source_systems as { name: string }).name}`}
                  </p>
                  <p className="text-sm text-muted-foreground">{order.district} — {order.address_text}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="secondary" className="text-xs">{FULFILLMENT_LABELS[order.fulfillment_status]}</Badge>
                  <Badge variant={order.payment_status === "paid" ? "default" : "outline"} className="text-xs">
                    {PAYMENT_LABELS[order.payment_status]}
                  </Badge>
                  {order.total_amount && (
                    <p className="text-sm font-medium text-foreground">₮{Number(order.total_amount).toLocaleString()}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                <Select
                  value={order.fulfillment_status}
                  onValueChange={(val) => user && updateStatus.mutate({ orderId: order.id, status: val as FulfillmentStatus, userId: user.id })}
                >
                  <SelectTrigger className="w-[200px] h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FULFILLMENT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={order.payment_status}
                  onValueChange={(val) => user && updatePayment.mutate({ orderId: order.id, status: val as PaymentStatus, userId: user.id })}
                >
                  <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={order.assigned_driver_user_id || ""}
                  onValueChange={(val) => user && assignDriver.mutate({ orderId: order.id, driverId: val, userId: user.id })}
                >
                  <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Жолооч" /></SelectTrigger>
                  <SelectContent>
                    {drivers?.map((d) => (
                      <SelectItem key={d.user_id} value={d.user_id}>
                        {d.profiles.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-9 text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Захиалга устгах уу?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {order.internal_order_number} — {order.customer_name} захиалгыг бүрмөсөн устгана. Энэ үйлдлийг буцаах боломжгүй.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Болих</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => deleteOrder.mutate(order.id)}
                      >
                        Устгах
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
