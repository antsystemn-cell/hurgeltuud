import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  useActiveOrders,
  useUpdateOrderStatus,
  useAssignDriver,
  useDrivers,
  useSourceSystems,
  FULFILLMENT_LABELS,
  PAYMENT_LABELS,
  type FulfillmentStatus,
} from "@/hooks/useOrders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Search } from "lucide-react";
import { STATUS_BORDER_COLORS, STATUS_BG_COLORS, formatOrderDate } from "@/lib/orderHelpers";

export default function OperatorDashboard() {
  const { user } = useAuth();
  const { data: orders, isLoading } = useActiveOrders();
  const { data: drivers } = useDrivers();
  const { data: sources } = useSourceSystems();
  const updateStatus = useUpdateOrderStatus();
  const assignDriver = useAssignDriver();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const filtered = orders?.filter((o) => {
    if (statusFilter !== "all" && o.fulfillment_status !== statusFilter) return false;
    if (sourceFilter !== "all" && o.source_system_id !== sourceFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        o.customer_name.toLowerCase().includes(s) ||
        o.phone.includes(s) ||
        o.internal_order_number.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const handleStatusChange = (orderId: string, status: FulfillmentStatus) => {
    if (!user) return;
    updateStatus.mutate({ orderId, status, userId: user.id });
  };

  const handleAssign = (orderId: string, driverId: string) => {
    if (!user) return;
    assignDriver.mutate({ orderId, driverId, userId: user.id });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <h2 className="text-xl font-semibold text-foreground">Идэвхтэй захиалгууд</h2>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Хайх..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүх статус</SelectItem>
            <SelectItem value="confirmed">Баталгаажсан</SelectItem>
            <SelectItem value="phone_confirmed">Утсаар баталгаажсан</SelectItem>
            <SelectItem value="out_for_delivery">Хүргэлтэнд</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Эх сайт" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүх сайт</SelectItem>
            {sources?.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Уншиж байна...</div>
      ) : !filtered?.length ? (
        <div className="text-center py-8 text-muted-foreground">Захиалга олдсонгүй</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((order) => {
            const date = formatOrderDate(order.created_at);
            const borderColor = STATUS_BORDER_COLORS[order.fulfillment_status];
            const bgColor = STATUS_BG_COLORS[order.fulfillment_status];
            return (
              <div key={order.id} className={`border border-border rounded-xl p-4 border-l-4 ${borderColor} ${bgColor}`}>
                <div className="flex items-start gap-3">
                  {/* Date column */}
                  <div className="flex-shrink-0 w-14 text-center">
                    <p className="text-2xl font-bold text-foreground leading-none">{date.day}</p>
                    <p className="text-[10px] text-muted-foreground">{date.month}</p>
                    <p className="text-xs text-muted-foreground font-medium">{date.time}</p>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{order.customer_name}</p>
                          <a href={`tel:${order.phone}`} className="text-primary">
                            <Phone className="h-4 w-4" />
                          </a>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {order.internal_order_number}
                          {order.source_systems && ` • ${(order.source_systems as { name: string }).name}`}
                        </p>
                        <p className="text-sm text-muted-foreground break-words">{[order.district, order.address_text].filter(Boolean).join(" — ")}</p>
                        {order.order_items?.map((item: { id: string; product_name_snapshot: string; quantity: number }) => (
                          <div key={item.id} className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-foreground">{item.product_name_snapshot}</span>
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                              {item.quantity} ш
                            </Badge>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="flex gap-1">
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">
                            {FULFILLMENT_LABELS[order.fulfillment_status]}
                          </Badge>
                          <Badge
                            variant={order.payment_status === "paid" ? "default" : "outline"}
                            className="text-xs"
                          >
                            {PAYMENT_LABELS[order.payment_status]}
                          </Badge>
                        </div>
                        {order.total_amount && (
                          <p className="text-sm font-medium text-foreground">₮{Number(order.total_amount).toLocaleString()}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
                      {order.fulfillment_status === "confirmed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(order.id, "phone_confirmed")}
                        >
                          Утсаар баталгаажуулсан
                        </Button>
                      )}
                      {(order.fulfillment_status === "confirmed" || order.fulfillment_status === "phone_confirmed") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(order.id, "out_for_delivery")}
                        >
                          Хүргэлтэнд
                        </Button>
                      )}

                      <Select
                        value={order.assigned_driver_user_id || ""}
                        onValueChange={(val) => handleAssign(order.id, val)}
                      >
                        <SelectTrigger className="w-[160px] h-9 text-xs">
                          <SelectValue placeholder="Жолооч оноох" />
                        </SelectTrigger>
                        <SelectContent>
                          {drivers?.map((d) => (
                            <SelectItem key={d.user_id} value={d.user_id}>
                              {d.profiles.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
