import { useDriverShopEarnings } from "@/hooks/useWallet";
import { Store, Package } from "lucide-react";

type Props = {
  driverUserId: string;
  className?: string;
};

/**
 * Shows a driver's delivery earnings broken down per shop (merchant):
 * how many deliveries were done for each shop and the total earned.
 * Used in both the driver wallet page and the admin wallet detail dialog.
 */
export function ShopEarningsBreakdown({ driverUserId, className }: Props) {
  const { data: shops, isLoading } = useDriverShopEarnings(driverUserId);

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Уншиж байна...</p>;
  }

  if (!shops?.length) {
    return <p className="text-xs text-muted-foreground">Хүргэлтийн орлого байхгүй</p>;
  }

  const grandTotal = shops.reduce((sum, s) => sum + s.total, 0);
  const grandCount = shops.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className={className}>
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
            <p className="shrink-0 pl-2 text-sm font-semibold text-emerald-600">
              ₮{s.total.toLocaleString()}
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
