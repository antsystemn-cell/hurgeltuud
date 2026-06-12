import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCreateOrder } from "@/hooks/useOrders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSourceSystems } from "@/hooks/useOrders";
import { toast } from "sonner";
import { PlusCircle, Trash2 } from "lucide-react";

interface ItemRow {
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
}

export default function CreateOrder() {
  const { user } = useAuth();
  const createOrder = useCreateOrder();
  const { data: sources } = useSourceSystems();

  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    alternate_phone: "",
    district: "",
    address_text: "",
    delivery_note: "",
    payment_method: "",
    payment_status: "unpaid" as "unpaid" | "cash_on_delivery" | "paid" | "refunded",
    delivery_fee: "",
    customer_note: "",
    source_channel: "manual",
    source_system_id: "",
  });

  const [items, setItems] = useState<ItemRow[]>([{ product_name_snapshot: "", quantity: 1, unit_price: 0 }]);

  const addItem = () => setItems([...items, { product_name_snapshot: "", quantity: 1, unit_price: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof ItemRow, value: string | number) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: value };
    setItems(next);
  };

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const deliveryFee = parseFloat(form.delivery_fee) || 0;
  const total = subtotal + deliveryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!form.district) {
      toast.error("Дүүрэг сонгоно уу");
      return;
    }

    try {
      await createOrder.mutateAsync({
        order: {
          customer_name: form.customer_name,
          phone: form.phone,
          alternate_phone: form.alternate_phone || null,
          district: form.district || null,
          address_text: form.address_text || null,
          delivery_note: form.delivery_note || null,
          payment_method: form.payment_method || null,
          payment_status: form.payment_status,
          delivery_fee: deliveryFee,
          subtotal,
          total_amount: total,
          customer_note: form.customer_note || null,
          source_channel: form.source_channel,
          source_system_id: form.source_system_id || null,
          created_by_user_id: user.id,
          fulfillment_status: "confirmed",
        },
        items: items
          .filter((item) => item.product_name_snapshot.trim())
          .map((item) => ({
            product_name_snapshot: item.product_name_snapshot,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.quantity * item.unit_price,
          })),
      });
      toast.success("Захиалга үүсгэлээ");
      // Reset
      setForm({
        customer_name: "",
        phone: "",
        alternate_phone: "",
        district: "",
        address_text: "",
        delivery_note: "",
        payment_method: "",
        payment_status: "unpaid",
        delivery_fee: "",
        customer_note: "",
        source_channel: "manual",
        source_system_id: "",
      });
      setItems([{ product_name_snapshot: "", quantity: 1, unit_price: 0 }]);
    } catch {
      toast.error("Алдаа гарлаа");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-foreground mb-4">Шинэ захиалга</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Захиалагч</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Нэр *</Label>
              <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Утас *</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Нэмэлт утас</Label>
              <Input value={form.alternate_phone} onChange={(e) => setForm({ ...form, alternate_phone: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Дүүрэг *</Label>
            <Select value={form.district} onValueChange={(v) => setForm({ ...form, district: v })}>
              <SelectTrigger><SelectValue placeholder="Дүүрэг сонгох" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="БЗД">БЗД</SelectItem>
                <SelectItem value="БГД">БГД</SelectItem>
                <SelectItem value="СХД">СХД</SelectItem>
                <SelectItem value="ЧД">ЧД</SelectItem>
                <SelectItem value="ХУД">ХУД</SelectItem>
                <SelectItem value="НД">НД</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Хаяг</Label>
            <Textarea value={form.address_text} onChange={(e) => setForm({ ...form, address_text: e.target.value })} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Хүргэлтийн тэмдэглэл</Label>
            <Input value={form.delivery_note} onChange={(e) => setForm({ ...form, delivery_note: e.target.value })} />
          </div>
        </div>

        {/* Items */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Бараа</h3>
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 items-end">
              <div className="flex-1 space-y-1.5">
                <Label>Нэр</Label>
                <Input value={item.product_name_snapshot} onChange={(e) => updateItem(i, "product_name_snapshot", e.target.value)} />
              </div>
              <div className="w-20 space-y-1.5">
                <Label>Тоо</Label>
                <Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(i, "quantity", parseInt(e.target.value) || 1)} />
              </div>
              <div className="w-28 space-y-1.5">
                <Label>Үнэ</Label>
                <Input type="number" min={0} value={item.unit_price} onChange={(e) => updateItem(i, "unit_price", parseFloat(e.target.value) || 0)} />
              </div>
              {items.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <PlusCircle className="h-4 w-4 mr-1" /> Бараа нэмэх
          </Button>
        </div>

        {/* Payment */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Төлбөр</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Төлбөрийн хэлбэр</Label>
              <Input value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder="Бэлэн, Данс..." />
            </div>
            <div className="space-y-1.5">
              <Label>Төлбөрийн статус</Label>
              <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v as "unpaid" | "cash_on_delivery" | "paid" | "refunded" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Төлөгдөөгүй</SelectItem>
                  <SelectItem value="cash_on_delivery">Бэлнээр</SelectItem>
                  <SelectItem value="paid">Төлөгдсөн</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Хүргэлтийн хураамж</Label>
              <Input type="number" min={0} value={form.delivery_fee} onChange={(e) => setForm({ ...form, delivery_fee: e.target.value })} />
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            Дүн: ₮{subtotal.toLocaleString()} + ₮{deliveryFee.toLocaleString()} = <span className="font-semibold text-foreground">₮{total.toLocaleString()}</span>
          </div>
        </div>

        {/* Source */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Эх сурвалж</Label>
            <Select value={form.source_channel} onValueChange={(v) => setForm({ ...form, source_channel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Гараар</SelectItem>
                <SelectItem value="phone">Утасны захиалга</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="walk_in">Биечлэн</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Эх сайт</Label>
            <Select value={form.source_system_id} onValueChange={(v) => setForm({ ...form, source_system_id: v })}>
              <SelectTrigger><SelectValue placeholder="Сонгох (заавал биш)" /></SelectTrigger>
              <SelectContent>
                {sources?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Тэмдэглэл</Label>
          <Textarea value={form.customer_note} onChange={(e) => setForm({ ...form, customer_note: e.target.value })} rows={2} />
        </div>

        <Button type="submit" className="w-full" disabled={createOrder.isPending}>
          {createOrder.isPending ? "Үүсгэж байна..." : "Захиалга үүсгэх"}
        </Button>
      </form>
    </div>
  );
}
