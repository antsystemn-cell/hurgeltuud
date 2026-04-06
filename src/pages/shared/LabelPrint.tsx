import { useState, useRef } from "react";
import { useOrders, FULFILLMENT_LABELS, PAYMENT_LABELS } from "@/hooks/useOrders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Printer, Search } from "lucide-react";

export default function LabelPrint() {
  const { data: orders } = useOrders();
  const [search, setSearch] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = orders?.filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.customer_name.toLowerCase().includes(s) ||
      o.phone.includes(s) ||
      o.internal_order_number.toLowerCase().includes(s)
    );
  });

  const selectedOrder = orders?.find((o) => o.id === selectedId);

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
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
      ${printRef.current.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Шошго хэвлэх</h2>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Захиалга хайх..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Order list */}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {filtered?.map((o) => (
            <button
              key={o.id}
              onClick={() => setSelectedId(o.id)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedId === o.id ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              <p className="text-sm font-medium text-foreground">{o.customer_name}</p>
              <p className="text-xs text-muted-foreground">{o.internal_order_number} • {o.district}</p>
            </button>
          ))}
        </div>

        {/* Label preview */}
        <div className="space-y-3">
          {selectedOrder ? (
            <>
              <div
                ref={printRef}
                className="bg-card border-2 border-dashed border-border rounded-lg p-4 space-y-2"
                style={{ width: "70mm", minHeight: "80mm", fontSize: "11px" }}
              >
                <div className="district" style={{ fontSize: "16px", fontWeight: "bold" }}>
                  {selectedOrder.district || "—"}
                </div>
                <div>{selectedOrder.address_text}</div>
                <div>{selectedOrder.phone}</div>
                <div className="items" style={{ margin: "6px 0" }}>
                  {selectedOrder.order_items?.map((item: { id: string; product_name_snapshot: string; quantity: number }) => (
                    <div key={item.id}>{item.product_name_snapshot} × {item.quantity}</div>
                  ))}
                </div>
                {selectedOrder.payment_status !== "paid" && (
                  <div className="payment-note" style={{ fontWeight: "bold", border: "1px solid #000", padding: "2px 4px" }}>
                    ⚠ {PAYMENT_LABELS[selectedOrder.payment_status]}
                    {selectedOrder.total_amount ? ` — ₮${Number(selectedOrder.total_amount).toLocaleString()}` : ""}
                  </div>
                )}
                <div className="footer" style={{ marginTop: "8px", fontSize: "9px", textAlign: "center", borderTop: "1px dashed #000", paddingTop: "4px" }}>
                  Баярлалаа! 🙏
                </div>
              </div>
              <Button onClick={handlePrint} className="w-full">
                <Printer className="h-4 w-4 mr-2" /> Хэвлэх
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Захиалга сонгоно уу</p>
          )}
        </div>
      </div>
    </div>
  );
}
