import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  useDriverWallet,
  useWalletTransactions,
  useWithdrawalRequests,
  useCreateWithdrawalRequest,
  useDriverShopSettlement,
  TX_TYPE_LABELS,
  WITHDRAWAL_STATUS_LABELS,
} from "@/hooks/useWallet";
import { ShopEarningsBreakdown } from "@/components/driver/ShopEarningsBreakdown";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import { Wallet, ArrowDownToLine, ArrowUpFromLine, TrendingUp, History, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";

const TABS = [
  { key: "overview", label: "Хэтэвч", icon: <Wallet className="h-4 w-4" /> },
  { key: "history", label: "Гүйлгээ", icon: <History className="h-4 w-4" /> },
  { key: "withdrawals", label: "Татсан", icon: <ArrowDownToLine className="h-4 w-4" /> },
] as const;

export default function DriverWallet() {
  const { user } = useAuth();
  const userId = user?.id || "";
  const { data: wallet, isLoading: walletLoading } = useDriverWallet(userId);
  const { data: transactions } = useWalletTransactions(userId);
  const { data: withdrawals } = useWithdrawalRequests(userId);
  const { data: shopSettlement } = useDriverShopSettlement(userId);
  const createWithdrawal = useCreateWithdrawalRequest();

  const [tab, setTab] = useState<string>("overview");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [selectedShopCode, setSelectedShopCode] = useState<string>("");

  const balance = Number(wallet?.balance || 0);
  const totalEarned = Number(wallet?.total_earned || 0);
  const totalWithdrawn = Number(wallet?.total_withdrawn || 0);

  // Only shops that still have an outstanding (un-withdrawn) balance can be settled.
  // Each shop is settled as ONE whole request for its full delivered total — no
  // manual partial amounts, which kept producing messy fractional withdrawals.
  const settleableShops = (shopSettlement || [])
    .map((s) => ({ ...s, amount: Math.round(s.outstanding) }))
    .filter((s) => s.amount > 0 && s.amount <= balance);

  const handleWithdrawShop = (shop: (typeof settleableShops)[number]) => {
    if (!wallet || !user) return;
    if (shop.amount <= 0 || shop.amount > balance) {
      toast({ title: "Алдаа", description: "Татах боломжгүй дүн", variant: "destructive" });
      return;
    }
    createWithdrawal.mutate(
      {
        walletId: wallet.id,
        driverUserId: user.id,
        amount: shop.amount,
        bankName: bankName || undefined,
        bankAccount: bankAccount || undefined,
        note: `${shop.name} хүргэлтийн төлбөр`,
      },
      {
        onSuccess: () => {
          toast({ title: "Хүсэлт илгээгдлээ" });
          setSelectedShopCode("");
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : "Дахин оролдоно уу";
          toast({ title: "Алдаа гарлаа", description: message, variant: "destructive" });
        },
      }
    );
  };


  if (walletLoading) {
    return <div className="p-4 text-center text-muted-foreground">Уншиж байна...</div>;
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 rounded-xl p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          {/* Balance card */}
          <div className="bg-primary rounded-2xl p-6 text-primary-foreground">
            <p className="text-sm opacity-80">Үлдэгдэл</p>
            <p className="text-3xl font-bold mt-1">₮{balance.toLocaleString()}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs">Нийт орлого</span>
              </div>
              <p className="text-lg font-semibold text-foreground">₮{totalEarned.toLocaleString()}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <ArrowUpFromLine className="h-4 w-4" />
                <span className="text-xs">Нийт татсан</span>
              </div>
              <p className="text-lg font-semibold text-foreground">₮{totalWithdrawn.toLocaleString()}</p>
            </div>
          </div>

          {/* Earnings broken down per shop */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Дэлгүүр тус бүрийн орлого</h3>
            </div>
            <ShopEarningsBreakdown driverUserId={userId} />
          </div>

          {/* Withdrawal form — one whole-amount request per shop */}
          {wallet && balance > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <h3 className="font-medium text-foreground text-sm">Мөнгө татах хүсэлт</h3>
              <p className="text-[11px] text-muted-foreground">
                Дэлгүүр бүрийн хүргэлтийн төлбөрийг бүтэн дүнгээр нь татах хүсэлт илгээнэ.
                Админ баталгаажуулж шилжүүлсний дараа хэтэвчнээс хасагдана.
              </p>
              <div className="space-y-2">
                <Input
                  placeholder="Банкны нэр"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
                <Input
                  placeholder="Дансны дугаар"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                />
              </div>

              {settleableShops.length > 0 ? (
                <div className="space-y-2">
                  {settleableShops.map((shop) => (
                    <AlertDialog
                      key={shop.code}
                      open={selectedShopCode === shop.code}
                      onOpenChange={(o) => setSelectedShopCode(o ? shop.code : "")}
                    >
                      <AlertDialogTrigger asChild>
                        <button
                          disabled={createWithdrawal.isPending}
                          className="flex w-full items-center justify-between rounded-xl border border-border bg-background p-3 text-left transition-colors hover:bg-secondary/50 disabled:opacity-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{shop.name}</p>
                            <p className="text-xs text-muted-foreground">{shop.count} хүргэлт</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 pl-2">
                            <span className="text-sm font-semibold text-foreground">
                              ₮{shop.amount.toLocaleString()}
                            </span>
                            <ArrowDownToLine className="h-4 w-4 text-primary" />
                          </div>
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Мөнгө татах уу?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {shop.name} — ₮{shop.amount.toLocaleString()} ({shop.count} хүргэлт)
                            татах хүсэлт илгээх гэж байна. Админ зөвшөөрсний дараа банкны данс руу шилжүүлнэ.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Үгүй</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleWithdrawShop(shop)}>
                            Тийм
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Татах боломжтой дэлгүүрийн үлдэгдэл алга байна.
                </p>
              )}
            </div>
          )}


          {!wallet && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Та хүргэлт хийсний дараа хэтэвч үүснэ.
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-2">
          {!transactions?.length ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Гүйлгээ байхгүй</div>
          ) : (
            transactions.map((tx) => {
              const isPositive = tx.type === "delivery_earning" || tx.type === "adjustment_add";
              return (
                <div key={tx.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{TX_TYPE_LABELS[tx.type] || tx.type}</p>
                    {tx.description && <p className="text-xs text-muted-foreground truncate">{tx.description}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(tx.created_at).toLocaleString("mn-MN")}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className={cn("text-sm font-semibold", isPositive ? "text-emerald-600" : "text-destructive")}>
                      {isPositive ? "+" : "-"}₮{Number(tx.amount).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">₮{Number(tx.balance_after).toLocaleString()}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "withdrawals" && (
        <div className="space-y-2">
          {!withdrawals?.length ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Татах хүсэлт байхгүй</div>
          ) : (
            withdrawals.map((w) => (
              <div key={w.id} className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">₮{Number(w.amount).toLocaleString()}</p>
                  <Badge
                    variant={
                      w.status === "completed" ? "default" :
                      w.status === "rejected" ? "destructive" :
                      w.status === "approved" ? "secondary" : "outline"
                    }
                    className="text-xs"
                  >
                    {WITHDRAWAL_STATUS_LABELS[w.status] || w.status}
                  </Badge>
                </div>
                {w.bank_name && (
                  <p className="text-xs text-muted-foreground mt-1">{w.bank_name} — {w.bank_account}</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(w.created_at).toLocaleString("mn-MN")}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
