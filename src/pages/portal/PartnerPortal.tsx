import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import logo from "@/assets/logo.png";
import {
  usePortalSession,
  usePortalOrders,
  usePortalDrivers,
  usePortalMerchants,
  usePortalAssignDriver,
  usePortalUpdateFulfillment,
  usePortalUpdatePayment,
  usePortalUpdateAddress,
} from "@/hooks/usePartnerPortal";
import { FULFILLMENT_LABELS, PAYMENT_LABELS, type FulfillmentStatus, type PaymentStatus } from "@/hooks/useOrders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Phone, Pencil, Check, X } from "lucide-react";
import { STATUS_BORDER_COLORS, STATUS_BG_COLORS, formatOrderDate, detectDistrict } from "@/lib/orderHelpers";

const DISTRICTS = ["БЗД", "БГД", "СХД", "ЧД", "ХУД", "НД"];

function EditableAddress({ order, token }: { order: any; token: string }) {
  const [editing, setEditing] = useState(false);
  const [district, setDistrict] = useState(order.district || "");
  const [address, setAddress] = useState(order.address_text || "");
  const updateAddress = usePortalUpdateAddress(token);

  const handleSave = () => {
    updateAddress.mutate(
      { order_id: order.id, district, address_text: address },
      { onSuccess: () => setEditing(false) }
    );
  };

  if (!editing) {
    const fullAddress = [order.district, order.address_text].filter(Boolean).join(" — ");
    return (
      <div className="flex items-start gap-1 group">
        <p className="text-sm text-muted-foreground break-words">{fullAddress || "—"}</p>
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
      <Input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Дүүрэг" className="h-8 text-sm" />
      <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Хаяг" className="text-sm min-h-[60px]" />
      <div className="flex gap-1">
        <Button size="sm" className="h-7 text-xs px-2" onClick={handleSave} disabled={updateAddress.isPending}>
          <Check className="h-3 w-3 mr-1" /> Хадгалах
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditing(false)}>
          <X className="h-3 w-3 mr-1" /> Болих
        </Button>
      </div>
    </div>
  );
}

export default function PartnerPortal() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [merchantFilter, setMerchantFilter] = useState<string>("all");
  const [driverFilter, setDriverFilter] = useState<string>("all");

  const session = usePortalSession(token);
  const { data: orders, isLoading } = usePortalOrders(token, {
    status: statusFilter,
    search,
    merchant_code: merchantFilter,
    driver_id: driverFilter,
  });
  const { data: drivers } = usePortalDrivers(token);
  const { data: merchants } = usePortalMerchants(token);
  const assignDriver = usePortalAssignDriver(token);
  const updateStatus = usePortalUpdateFulfillment(token);
  const updatePayment = usePortalUpdatePayment(token);
  const updateAddress = usePortalUpdateAddress(token);

  if (!token) {
    return (
      <div className="flex items-center justify-center h-screen text-center px-4 text-muted-foreground">
        Хүчинтэй холбоос алга. Та өөрийн системийн админ панелаас "Хүргэлт удирдах" цэсээр дамжин орно уу.
      </div>
    );
  }

  if (session.isError) {
    return (
      <div className="flex items-center justify-center h-screen text-center px-4 text-muted-foreground">
        Холболтын хугацаа дууссан эсвэл буруу байна. Хуудсаа дахин нээнэ үү.
      </div>
    );
  }

  const sourceName = (session.data as any)?.source_system?.name;
  const merchantName = (session.data as any)?.merchant?.name;
  const scopeLabel = merchantName ? `${sourceName ? sourceName + " · " : ""}${merchantName}` : sourceName;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-border bg-card">
        <img src={logo} alt="ON Shop" className="h-8 w-8" />
        <div>
          <h1 className="text-base font-semibold text-foreground">Хүргэлт удирдах</h1>
          {scopeLabel && <p className="text-xs text-muted-foreground">{scopeLabel}</p>}
        </div>
      </header>

      <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Нэр, утас, хаягаар хайх..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
          {!!merchants?.length && (
            <Select value={merchantFilter} onValueChange={setMerchantFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Дэлгүүр" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх дэлгүүр</SelectItem>
                {merchants.map((m: any) => <SelectItem key={m.code} value={m.code}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={driverFilter} onValueChange={setDriverFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Жолооч" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх жолооч</SelectItem>
              {drivers?.map((d: any) => (
                <SelectItem key={d.user_id} value={d.user_id}>
                  {d.full_name} — {d.phone}
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
            {orders.map((order: any) => {
              const date = formatOrderDate(order.created_at);
              const borderColor = STATUS_BORDER_COLORS[order.fulfillment_status as FulfillmentStatus];
              const bgColor = STATUS_BG_COLORS[order.fulfillment_status as FulfillmentStatus];
              return (
                <div key={order.id} className={`border border-border rounded-xl p-4 border-l-4 ${borderColor} ${bgColor}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-14 text-center">
                      <p className="text-2xl font-bold text-foreground leading-none">{date.day}</p>
                      <p className="text-[10px] text-muted-foreground">{date.month}</p>
                      <p className="text-xs text-muted-foreground font-medium">{date.time}</p>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{order.customer_name}</p>
                          <a href={`tel:${order.phone}`} className="text-primary font-medium text-sm flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            {order.phone}
                          </a>
                          <p className="text-xs text-muted-foreground">{order.internal_order_number}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">{FULFILLMENT_LABELS[order.fulfillment_status as FulfillmentStatus]}</Badge>
                          <Badge variant={order.payment_status === "paid" ? "default" : "outline"} className="text-xs">
                            {PAYMENT_LABELS[order.payment_status as PaymentStatus]}
                          </Badge>
                          {order.total_amount ? (
                            <p className="text-sm font-medium text-foreground">₮{Number(order.total_amount).toLocaleString()}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-1"><EditableAddress order={order} token={token} /></div>

                      {order.order_items?.length > 0 && (
                        <div className="mt-2 space-y-0.5">
                          {order.order_items.map((item: any) => (
                            <div key={item.id} className="flex items-center gap-2 text-sm">
                              <span className="font-medium text-foreground">{item.product_name_snapshot}</span>
                              <Badge variant="outline" className="text-xs px-1.5 py-0">{item.quantity} ш</Badge>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
                        <Select
                          value={order.fulfillment_status}
                          onValueChange={(val) => updateStatus.mutate({ order_id: order.id, status: val })}
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
                          onValueChange={(val) => updatePayment.mutate({ order_id: order.id, status: val })}
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
                          onValueChange={(val) => assignDriver.mutate({ order_id: order.id, driver_id: val })}
                        >
                          <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Жолооч сонгох" /></SelectTrigger>
                          <SelectContent>
                            {drivers?.map((d: any) => (
                              <SelectItem key={d.user_id} value={d.user_id}>
                                {d.full_name} — {d.phone}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={order.district || detectDistrict(order.address_text) || ""}
                          onValueChange={(val) => updateAddress.mutate({ order_id: order.id, district: val, address_text: order.address_text || "" })}
                        >
                          <SelectTrigger className="w-[120px] h-9 text-xs"><SelectValue placeholder="Дүүрэг" /></SelectTrigger>
                          <SelectContent>
                            {DISTRICTS.map((d) => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
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
    </div>
  );
}
