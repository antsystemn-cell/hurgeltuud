import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useOrders, useDrivers, useSourceSystems, useMerchants, useUpdateOrderStatus, useAssignDriver, useUpdatePaymentStatus, useDeleteOrder, useUpdateOrderAddress, useManualRetrySync, useResendTelegramNotification, FULFILLMENT_LABELS, PAYMENT_LABELS, type FulfillmentStatus, type PaymentStatus } from "@/hooks/useOrders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Search, Phone, Trash2, Printer, Pencil, Check, X, Store, RefreshCw, AlertTriangle, Send } from "lucide-react";
import { STATUS_BORDER_COLORS, STATUS_BG_COLORS, formatOrderDate, detectDistrict } from "@/lib/orderHelpers";

const DISTRICTS = ["БЗД", "БГД", "СХД", "ЧД", "ХУД", "НД"];




function EditableAddress({ order, userId }: { order: any; userId: string }) {
  const [editing, setEditing] = useState(false);
  const [district, setDistrict] = useState(order.district || "");
  const [address, setAddress] = useState(order.address_text || "");
  const updateAddress = useUpdateOrderAddress();

  const handleSave = () => {
    updateAddress.mutate(
      { orderId: order.id, district, addressText: address, userId },
      { onSuccess: () => setEditing(false) }
    );
  };

  const handleCancel = () => {
    setDistrict(order.district || "");
    setAddress(order.address_text || "");
    setEditing(false);
  };

  if (!editing) {
    const fullAddress = [order.district || detectDistrict(order.address_text), order.address_text].filter(Boolean).join(" — ");
    return (
      <div className="flex items-start gap-1 group">
        <p className="text-sm text-muted-foreground break-words">
          {fullAddress || "—"}
        </p>
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 md:transition-opacity p-0.5 rounded hover:bg-muted flex-shrink-0 mt-0.5"
          title="Хаяг засах"
        >
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Input
        value={district}
        onChange={(e) => setDistrict(e.target.value)}
        placeholder="Дүүрэг"
        className="h-8 text-sm"
      />
      <Textarea
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Хаяг"
        className="text-sm min-h-[60px]"
      />
      <div className="flex gap-1">
        <Button size="sm" className="h-7 text-xs px-2" onClick={handleSave} disabled={updateAddress.isPending}>
          <Check className="h-3 w-3 mr-1" /> Хадгалах
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={handleCancel}>
          <X className="h-3 w-3 mr-1" /> Болих
        </Button>
      </div>
    </div>
  );
}

export default function OrderList({ lockedSourceCode, title }: { lockedSourceCode?: string; title?: string } = {}) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [merchantFilter, setMerchantFilter] = useState<string>("all");
  const [driverFilter, setDriverFilter] = useState<string>("all");

  const { data: drivers } = useDrivers();
  const { data: sources } = useSourceSystems();
  const { data: merchants } = useMerchants();

  // When locked to a single source (e.g. Only Shop delivery management), resolve
  // its id and force the source filter to it, hiding the source dropdown.
  const lockedSourceId = lockedSourceCode
    ? sources?.find((s) => s.code === lockedSourceCode)?.id
    : undefined;

  const effectiveSourceId = lockedSourceCode ? lockedSourceId : (sourceFilter !== "all" ? sourceFilter : undefined);

  const { data: orders, isLoading } = useOrders({
    fulfillment_status: statusFilter !== "all" ? statusFilter as FulfillmentStatus : undefined,
    source_system_id: effectiveSourceId,
    merchant_code: merchantFilter !== "all" ? merchantFilter : undefined,
    driver_id: driverFilter !== "all" ? driverFilter : undefined,
    search: search || undefined,
  });
  const updateStatus = useUpdateOrderStatus();
  const assignDriver = useAssignDriver();
  const updatePayment = useUpdatePaymentStatus();
  const deleteOrder = useDeleteOrder();
  const retrySync = useManualRetrySync();
  const updateAddress = useUpdateOrderAddress();
  const resendTelegram = useResendTelegramNotification();

  const handleAssign = (orderId: string, driverId: string) => {
    if (!user) return;
    assignDriver.mutate(
      { orderId, driverId, userId: user.id },
      {
        onSuccess: ({ telegram }) => {
          if (!telegram) return;
          if (telegram.sent) toast.success("Telegram мэдэгдэл амжилттай илгээгдлээ.");
          else if (telegram.skipped) toast.message("Telegram мэдэгдэл илгээгдсэнгүй: chat ID тохируулаагүй байна.");
          else if (telegram.error) toast.warning("Захиалга жолоочид оноогдсон. Харин Telegram мэдэгдэл илгээхэд алдаа гарлаа.");
        },
        onError: (e) => toast.error((e as Error).message),
      }
    );
  };

  const handleResendTelegram = (orderId: string) => {
    resendTelegram.mutate(orderId, {
      onSuccess: (telegram) => {
        if (telegram?.sent) toast.success("Telegram мэдэгдэл дахин илгээгдлээ.");
        else if (telegram?.skipped) toast.message(`Telegram илгээгдсэнгүй: ${telegram.skipped}`);
        else toast.warning(`Telegram алдаа: ${telegram?.error || "тодорхойгүй"}`);
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };


  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <h2 className="text-xl font-semibold text-foreground">{title || "Бүх захиалгууд"}</h2>

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
        {!lockedSourceCode && (
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Эх сайт" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх сайт</SelectItem>
              {sources?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {!!merchants?.length && (
          <Select value={merchantFilter} onValueChange={setMerchantFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Дэлгүүр" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх дэлгүүр</SelectItem>
              {merchants.map((m) => <SelectItem key={m.code} value={m.code}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={driverFilter} onValueChange={setDriverFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Жолооч" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүх жолооч</SelectItem>

            {drivers?.map((d) => (
              <SelectItem key={d.user_id} value={d.user_id}>
                {d.profiles.full_name} — {d.profiles.phone}
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
          {orders.map((order) => {
            const date = formatOrderDate(order.created_at);
            const borderColor = STATUS_BORDER_COLORS[order.fulfillment_status];
            const bgColor = STATUS_BG_COLORS[order.fulfillment_status];
            return (
              <div key={order.id} className={`border border-border rounded-xl p-4 border-l-4 ${borderColor} ${bgColor}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-14 text-center">
                    <p className="text-2xl font-bold text-foreground leading-none">{date.day}</p>
                    <p className="text-[10px] text-muted-foreground">{date.month}</p>
                    <p className="text-xs text-muted-foreground font-medium">{date.time}</p>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Top row: name + badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground">{order.customer_name}</p>
                          {(order as any).merchant_name && (
                            <Badge variant="outline" className="text-xs whitespace-nowrap gap-1">
                              <Store className="h-3 w-3" />
                              {(order as any).merchant_name}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <a href={`tel:${order.phone}`} className="text-primary font-medium text-sm flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            {order.phone}
                          </a>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {order.internal_order_number}
                          {order.source_systems && ` • ${(order.source_systems as { name: string }).name}`}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Badge variant="secondary" className="text-xs whitespace-nowrap">{FULFILLMENT_LABELS[order.fulfillment_status]}</Badge>
                        <Badge variant={order.payment_status === "paid" ? "default" : "outline"} className="text-xs">
                          {PAYMENT_LABELS[order.payment_status]}
                        </Badge>
                        {order.total_amount && (
                          <p className="text-sm font-medium text-foreground">₮{Number(order.total_amount).toLocaleString()}</p>
                        )}
                        {(order as any).sync_error && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] gap-1 border-destructive/40 text-destructive hover:text-destructive"
                            onClick={() => retrySync.mutate(order.id)}
                            disabled={retrySync.isPending}
                            title={(order as any).sync_error}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Sync алдаа
                            <RefreshCw className={`h-3 w-3 ${retrySync.isPending ? "animate-spin" : ""}`} />
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* Address - full width */}
                    {user && <div className="mt-1">{<EditableAddress order={order} userId={user.id} />}</div>}
                    {/* Items - full width */}
                    {(order as any).order_items?.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {(order as any).order_items.map((item: any) => (
                          <div key={item.id} className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-foreground">{item.product_name_snapshot}</span>
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                              {item.quantity} ш
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
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
                        onValueChange={(val) => handleAssign(order.id, val)}
                      >
                        <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Жолооч" /></SelectTrigger>
                        <SelectContent>
                          {drivers?.map((d) => (
                            <SelectItem key={d.user_id} value={d.user_id}>
                              {d.profiles.full_name} — {d.profiles.phone}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {order.assigned_driver_user_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 text-xs gap-1"
                          onClick={() => handleResendTelegram(order.id)}
                          disabled={resendTelegram.isPending}
                          title="Telegram мэдэгдлийг дахин илгээх"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Telegram дахин
                        </Button>
                      )}
                      <Select
                        value={order.district || detectDistrict(order.address_text) || ""}
                        onValueChange={(val) => user && updateAddress.mutate({ orderId: order.id, district: val, addressText: order.address_text || "", userId: user.id })}
                      >
                        <SelectTrigger className="w-[120px] h-9 text-xs"><SelectValue placeholder="Дүүрэг" /></SelectTrigger>
                        <SelectContent>
                          {DISTRICTS.map((d) => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 text-xs"
                        onClick={() => {
                          const printWindow = window.open("", "_blank");
                          if (!printWindow) return;
                          const items = (order as any).order_items || [];
                          printWindow.document.write(`
                            <html><head><title>Label</title>
                            <style>
                              @page { size: 70mm 80mm; margin: 0; }
                              body { margin: 0; padding: 4mm; font-family: sans-serif; font-size: 11px; width: 70mm; }
                              .district { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
                              .row { margin-bottom: 2px; }
                              .items { margin: 6px 0; }
                              .footer { margin-top: 8px; font-size: 9px; text-align: center; border-top: 1px dashed #000; padding-top: 4px; }
                              .payment-note { font-weight: bold; margin-top: 4px; padding: 2px 4px; border: 1px solid #000; }
                            </style></head><body>
                            <div class="district">${order.district || detectDistrict(order.address_text) || "—"}</div>
                            <div>${order.address_text || ""}</div>
                            <div>${order.phone}</div>
                            <div class="items">${items.map((it: any) => `<div>${it.product_name_snapshot} × ${it.quantity}</div>`).join("")}</div>
                            ${order.payment_status !== "paid" ? `<div class="payment-note">⚠ ${PAYMENT_LABELS[order.payment_status]}${order.total_amount ? ` — ₮${Number(order.total_amount).toLocaleString()}` : ""}</div>` : ""}
                            <div class="footer">Баярлалаа! 🙏</div>
                            </body></html>
                          `);
                          printWindow.document.close();
                          printWindow.print();
                        }}
                      >
                        <Printer className="h-4 w-4 mr-1" /> Хэвлэх
                      </Button>
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
