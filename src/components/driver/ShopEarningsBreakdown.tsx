import { useState } from "react";
import { useDriverShopSettlement } from "@/hooks/useWallet";
import { Store, Package } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  driverUserId: string;
  className?: string;
};

type ViewKey = "all" | "pending" | "withdrawn";

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "all", label: "Бүгд" },
  { key: "pending", label: "Хүлээгдэж буй" },
  { key: "withdrawn", label: "Татсан" },
];

/**
 * Shows a driver's delivery earnings broken down per shop (merchant).
 * Each shop can be viewed by: total earned (Бүгд), the amount still to be
 * settled (Хүлээгдэж буй) or the amount already withdrawn (Татсан).
 * Used in both the driver wallet page and the admin wallet detail dialog.
 */
export function ShopEarningsBreakdown({ driverUserId, className }: Props) {
  const { data: shops, isLoading } = useDriverShopSettlement(driverUserId);
  const [view, setView] = useState<ViewKey>("all");

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Уншиж байна...</p>;
  }

  if (!shops?.length) {
    return <p className="text-xs text-muted-foreground">Хүргэлтийн орлого байхгүй</p>;
  }

  const valueFor = (s: (typeof shops)[number]) =>
    Math.round(
      view === "all" ? s.total : view === "pending" ? s.outstanding : s.withdrawn
    );

  const amountColor =
    view === "withdrawn"
      ? "text-muted-foreground"
      : view === "pending"
        ? "text-amber-600"
        : "text-emerald-600";

  const grandTotal = shops.reduce((sum, s) => sum + valueFor(s), 0);
  const grandCount = shops.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className={className}>
      {/* View filter */}
      <div className="mb-2 flex gap-1 rounded-xl bg-secondary/50 p-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={cn(
              "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
              view === v.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {shops.map((s) => (
          <div
            key={s.code}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Store className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Package className="h-3 w-3" />
                  {s.count} хүргэлт
                </p>
              </div>
            </div>
            <p className={cn("shrink-0 pl-2 text-sm font-semibold", amountColor)}>
              ₮{valueFor(s).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          Нийт {grandCount} хүргэлт
        </span>
        <span className="text-sm font-bold text-foreground">₮{grandTotal.toLocaleString()}</span>
      </div>
    </div>
  );
}
