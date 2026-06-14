import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRecordDeliveryOutcome } from "@/hooks/useOrders";
import { DELIVERY_OUTCOMES } from "@/lib/orderHelpers";
import type { Order } from "@/hooks/useOrders";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Camera, CheckCircle2, XCircle, Loader2, ImagePlus, X } from "lucide-react";

const DELIVERED = DELIVERY_OUTCOMES.filter((o) => o.kind === "delivered");
const CANCELLED = DELIVERY_OUTCOMES.filter((o) => o.kind === "cancelled");

export function DeliveryOutcomeDialog({
  order,
  open,
  onOpenChange,
}: {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const record = useRecordDeliveryOutcome();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [outcome, setOutcome] = useState<string>("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedDef = DELIVERY_OUTCOMES.find((o) => o.code === outcome);

  const reset = useCallback(() => {
    setOutcome("");
    setNote("");
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }, [preview]);

  const handleFile = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    } else {
      setFile(null);
      setPreview(null);
    }
  };

  const handleClose = (next: boolean) => {
    if (submitting) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!user || !selectedDef) return;
    if (!file) {
      toast({ title: "Зураг оруулна уу", description: "Баталгаажуулах зураг заавал шаардлагатай.", variant: "destructive" });
      return;
    }
    if (!note.trim()) {
      toast({ title: "Тайлбар бичнэ үү", description: "Тодорхой тайлбар заавал бичнэ.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${order.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("delivery-proofs")
        .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
      if (upErr) throw upErr;

      await record.mutateAsync({
        orderId: order.id,
        status: selectedDef.kind,
        outcome: selectedDef.code,
        note: note.trim(),
        proofUrl: path,
        userId: user.id,
      });

      toast({
        title: selectedDef.kind === "delivered" ? "Хүргэсэн гэж бүртгэлээ" : "Цуцалсан гэж бүртгэлээ",
        description: selectedDef.label,
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Алдаа гарлаа", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Хүргэлтийн үр дүн бүртгэх</DialogTitle>
          <DialogDescription>
            {order.customer_name} — {order.internal_order_number}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Outcome selection */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Амжилттай хүргэсэн
            </p>
            <div className="space-y-1.5">
              {DELIVERED.map((o) => (
                <OutcomeOption key={o.code} label={o.label} active={outcome === o.code} kind="delivered" onClick={() => setOutcome(o.code)} />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-destructive flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" /> Хүргэгдээгүй / Буцаасан
            </p>
            <div className="space-y-1.5">
              {CANCELLED.map((o) => (
                <OutcomeOption key={o.code} label={o.label} active={outcome === o.code} kind="cancelled" onClick={() => setOutcome(o.code)} />
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Тайлбар <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Юу болсон талаар тодорхой бичнэ үү..."
              rows={3}
            />
          </div>

          {/* Photo */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Баталгаажуулах зураг <span className="text-destructive">*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            {preview ? (
              <div className="relative">
                <img src={preview} alt="Баталгаажуулах зураг" className="w-full max-h-56 object-cover rounded-lg border border-border" />
                <button
                  type="button"
                  onClick={() => handleFile(null)}
                  className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white"
                  aria-label="Зураг устгах"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm text-muted-foreground"
                >
                  <ImagePlus className="h-4 w-4" /> Зураг солих
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border py-6 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Camera className="h-6 w-6" />
                <span className="text-sm font-medium">Зураг авах / оруулах</span>
              </button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
            Болих
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !selectedDef || !file || !note.trim()}
            className={cn(selectedDef?.kind === "cancelled" && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Бүртгэх
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OutcomeOption({
  label,
  active,
  kind,
  onClick,
}: {
  label: string;
  active: boolean;
  kind: "delivered" | "cancelled";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
        active
          ? kind === "delivered"
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-foreground"
            : "border-destructive bg-destructive/10 text-foreground"
          : "border-border bg-card text-foreground hover:bg-secondary/50"
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
          active
            ? kind === "delivered"
              ? "border-emerald-500 bg-emerald-500"
              : "border-destructive bg-destructive"
            : "border-muted-foreground/40"
        )}
      >
        {active && <CheckCircle2 className="h-3 w-3 text-white" />}
      </span>
      <span className="flex-1">{label}</span>
    </button>
  );
}
