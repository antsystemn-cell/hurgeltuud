import { useState, useMemo, useRef } from "react";
import { useOrders, PAYMENT_LABELS } from "@/hooks/useOrders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { mapOrderToLabelData } from "@/lib/niimbot/mapOrder";
import { generateNiimbotXlsx, buildXlsxFilename } from "@/lib/niimbot/xlsx";
import { downloadBlob } from "@/lib/niimbot/transfer";
import {
  NiimbotPrintButton,
  NiimbotBulkXlsxButton,
} from "@/components/niimbot/NiimbotPrintButton";
import { NiimbotInstructionsModal } from "@/components/niimbot/NiimbotInstructionsModal";

export default function LabelPrint() {
  const { data: orders } = useOrders();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [showXlsxHelp, setShowXlsxHelp] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () =>
      orders?.filter((o) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          o.customer_name.toLowerCase().includes(s) ||
          o.phone.includes(s) ||
          o.internal_order_number.toLowerCase().includes(s)
        );
      }),
    [orders, search],
  );

  const selectedOrder = orders?.find((o) => o.id === selectedId);

  const toggleBulk = (id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!filtered) return;
    if (bulkSelected.size === filtered.length) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(filtered.map((o) => o.id)));
    }
  };

  const handleBulkExport = async () => {
    try {
      const chosen = orders?.filter((o) => bulkSelected.has(o.id)) ?? [];
      if (!chosen.length) {
        toast.error("Захиалга сонгоно уу");
        return;
      }
      const rows = chosen.map(mapOrderToLabelData);
      const blob = generateNiimbotXlsx(rows);
      downloadBlob(blob, buildXlsxFilename(rows.length));
      toast.success("Excel файл татагдлаа");
      setShowXlsxHelp(true);
    } catch (e) {
      console.error(e);
      toast.error("Excel үүсгэхэд алдаа гарлаа");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-xl font-semibold text-foreground">Шошго хэвлэх</h2>
        <FileSpreadsheet className="h-5 w-5 text-muted-foreground mt-1" />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Захиалга хайх..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Bulk Excel export bar */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={
                !!filtered?.length && bulkSelected.size === filtered.length
              }
              onCheckedChange={toggleAll}
            />
            <span className="text-foreground">Бүгдийг сонгох</span>
          </label>
          <span className="text-xs text-muted-foreground">
            {bulkSelected.size} сонгосон
          </span>
        </div>
        <NiimbotBulkXlsxButton
          onExport={handleBulkExport}
          count={bulkSelected.size}
        />
        <p className="text-xs text-muted-foreground">
          Niimbot аппын <span className="font-medium">Import Data Source</span>{" "}
          функцэд ашиглана. Олон захиалгыг нэг загвар руу импортолж бөөнөөр
          хэвлэнэ.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Order list */}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {filtered?.map((o) => (
            <div
              key={o.id}
              className={`flex items-start gap-2 p-3 rounded-lg border transition-colors ${
                selectedId === o.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card"
              }`}
            >
              <Checkbox
                checked={bulkSelected.has(o.id)}
                onCheckedChange={() => toggleBulk(o.id)}
                className="mt-1"
              />
              <button
                onClick={() => setSelectedId(o.id)}
                className="flex-1 text-left min-w-0"
              >
                <p className="text-sm font-medium text-foreground truncate">
                  {o.customer_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {o.internal_order_number} • {o.district}
                </p>
              </button>
            </div>
          ))}
        </div>

        {/* Single label preview + PNG/Share */}
        <div className="space-y-3">
          {selectedOrder ? (
            <>
              <div
                ref={previewRef}
                className="bg-white text-black border-2 border-dashed border-border rounded-lg p-4 space-y-2"
                style={{ width: "70mm", minHeight: "80mm", fontSize: "11px" }}
              >
                <div style={{ fontSize: "16px", fontWeight: "bold" }}>
                  {selectedOrder.district || "—"}
                </div>
                <div>{selectedOrder.address_text}</div>
                <div>{selectedOrder.phone}</div>
                <div style={{ margin: "6px 0" }}>
                  {selectedOrder.order_items?.map(
                    (item: {
                      id: string;
                      product_name_snapshot: string;
                      quantity: number;
                    }) => (
                      <div key={item.id}>
                        {item.product_name_snapshot} × {item.quantity}
                      </div>
                    ),
                  )}
                </div>
                {selectedOrder.payment_status !== "paid" && (
                  <div
                    style={{
                      fontWeight: "bold",
                      border: "1px solid #000",
                      padding: "2px 4px",
                    }}
                  >
                    ⚠ {PAYMENT_LABELS[selectedOrder.payment_status]}
                    {selectedOrder.total_amount
                      ? ` — ₮${Number(selectedOrder.total_amount).toLocaleString()}`
                      : ""}
                  </div>
                )}
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "9px",
                    textAlign: "center",
                    borderTop: "1px dashed #000",
                    paddingTop: "4px",
                  }}
                >
                  Баярлалаа! 🙏
                </div>
              </div>

              <NiimbotPrintButton
                getPreviewElement={() => previewRef.current}
                filenameSafeId={selectedOrder.internal_order_number}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Захиалга сонгоно уу
            </p>
          )}
        </div>
      </div>

      <NiimbotInstructionsModal
        open={showXlsxHelp}
        onOpenChange={setShowXlsxHelp}
        mode="xlsx"
      />
    </div>
  );
}
