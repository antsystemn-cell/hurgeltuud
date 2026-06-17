import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  useWalletSettings,
  useUpdateWalletSettings,
  useAllDriverWallets,
  useWithdrawalRequests,
  useAdminWalletAction,
  useApproveWithdrawal,
  useWalletTransactions,
  TX_TYPE_LABELS,
  WITHDRAWAL_STATUS_LABELS,
} from "@/hooks/useWallet";
import { useDrivers } from "@/hooks/useOrders";
import { ShopEarningsBreakdown } from "@/components/driver/ShopEarningsBreakdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Settings, Wallet, Users, Clock, Plus, Minus, ArrowRight, Eye, Store, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { downloadWithdrawalInvoicePdf } from "@/lib/withdrawalInvoice";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TABS = [
  { key: "wallets", label: "Хэтэвчүүд", icon: <Wallet className="h-4 w-4" /> },
  { key: "requests", label: "Хүсэлтүүд", icon: <Clock className="h-4 w-4" /> },
  { key: "settings", label: "Тохиргоо", icon: <Settings className="h-4 w-4" /> },
] as const;

export default function WalletManagement() {
  const { user } = useAuth();
  const [tab, setTab] = useState<string>("wallets");
  const { data: settings } = useWalletSettings();
  const updateSettings = useUpdateWalletSettings();
  const { data: wallets } = useAllDriverWallets();
  const { data: drivers } = useDrivers();
  const { data: requests } = useWithdrawalRequests();
  const adminAction = useAdminWalletAction();
  const approveWithdrawal = useApproveWithdrawal();

  const [fee, setFee] = useState<string>("");
  const [actionDriverId, setActionDriverId] = useState<string>("");
  const [actionType, setActionType] = useState<string>("adjustment_add");
  const [actionAmount, setActionAmount] = useState<string>("");
  const [actionDesc, setActionDesc] = useState<string>("");

  // Driver transaction detail dialog
  const [viewDriverId, setViewDriverId] = useState<string | null>(null);
  const { data: viewTxs } = useWalletTransactions(viewDriverId || "", 1000);

  const getDriverName = (driverUserId: string) => {
    const driver = drivers?.find((d) => d.user_id === driverUserId);
    return driver?.profiles?.full_name || driverUserId.slice(0, 8);
  };

  const handleSaveSettings = () => {
    if (!settings) return;
    const val = Number(fee || settings.delivery_fee_per_order);
    updateSettings.mutate(
      { id: settings.id, deliveryFeePerOrder: val },
      {
        onSuccess: () => toast({ title: "Тохиргоо хадгалагдлаа" }),
        onError: () => toast({ title: "Алдаа", variant: "destructive" }),
      }
    );
  };

  const handleAdminAction = () => {
    if (!user || !actionDriverId || !actionAmount) return;
    const amt = Number(actionAmount);
    if (isNaN(amt) || amt <= 0) return;
    adminAction.mutate(
      {
        driverUserId: actionDriverId,
        type: actionType as any,
        amount: amt,
        description: actionDesc || (actionType === "adjustment_add" ? "Админ нэмсэн" : "Админ хассан"),
        adminUserId: user.id,
      },
      {
        onSuccess: () => {
          toast({ title: "Гүйлгээ бүртгэгдлээ" });
          setActionAmount("");
          setActionDesc("");
        },
        onError: () => toast({ title: "Алдаа", variant: "destructive" }),
      }
    );
  };

  const handleRequestAction = (requestId: string, driverUserId: string, amount: number, action: "approved" | "rejected" | "completed") => {
    if (!user) return;
    approveWithdrawal.mutate(
      { requestId, driverUserId, amount, adminUserId: user.id, action },
      {
        onSuccess: () => toast({ title: action === "completed" ? "Шилжүүлэг хийгдлээ" : action === "approved" ? "Зөвшөөрлөө" : "Татгалзлаа" }),
        onError: () => toast({ title: "Алдаа", variant: "destructive" }),
      }
    );
  };

  const handleDownloadInvoice = async (r: any) => {
    const fee = Number(settings?.delivery_fee_per_order) || 8000;
    const amt = Number(r.amount) || 0;
    try {
      await downloadWithdrawalInvoicePdf({
        requestId: r.id,
        driverName: getDriverName(r.driver_user_id),
        amount: amt,
        shopName: r.note || null,
        bankName: r.bank_name || null,
        bankAccount: r.bank_account || null,
        statusLabel: WITHDRAWAL_STATUS_LABELS[r.status] || r.status,
        deliveryCount: fee > 0 ? Math.round(amt / fee) : null,
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at || null,
      });
      toast({ title: "Нэхэмжлэл татагдлаа" });
    } catch (e) {
      toast({ title: "PDF үүсгэхэд алдаа гарлаа", variant: "destructive" });
    }
  };



  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Хэтэвч удирдлага</h2>

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

      {/* Wallets tab */}
      {tab === "wallets" && (
        <div className="space-y-4">
          {/* Admin wallet action */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="font-medium text-foreground text-sm">Гүйлгээ бүртгэх</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Жолооч</Label>
                <Select value={actionDriverId} onValueChange={setActionDriverId}>
                  <SelectTrigger><SelectValue placeholder="Жолооч сонгох" /></SelectTrigger>
                  <SelectContent>
                    {drivers?.map((d) => (
                      <SelectItem key={d.user_id} value={d.user_id}>
                        {d.profiles?.full_name || d.user_id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Төрөл</Label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adjustment_add">Мөнгө нэмэх</SelectItem>
                    <SelectItem value="adjustment_subtract">Мөнгө хасах</SelectItem>
                    <SelectItem value="bank_transfer">Банк руу шилжүүлсэн</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Дүн (₮)</Label>
                <Input type="number" value={actionAmount} onChange={(e) => setActionAmount(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Тайлбар</Label>
                <Input value={actionDesc} onChange={(e) => setActionDesc(e.target.value)} placeholder="Тайлбар" />
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={!actionDriverId || !actionAmount || adminAction.isPending} size="sm">
                  {actionType === "adjustment_add" ? <Plus className="h-4 w-4 mr-1" /> : <Minus className="h-4 w-4 mr-1" />}
                  Бүртгэх
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Гүйлгээ бүртгэх үү?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {getDriverName(actionDriverId)} — ₮{Number(actionAmount || 0).toLocaleString()} {actionType === "adjustment_add" ? "нэмэх" : "хасах"}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Үгүй</AlertDialogCancel>
                  <AlertDialogAction onClick={handleAdminAction}>Тийм</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Driver wallets list */}
          <div className="space-y-2">
            {!wallets?.length ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Хэтэвч байхгүй</div>
            ) : (
              wallets.map((w) => (
                <div key={w.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground text-sm">{getDriverName(w.driver_user_id)}</p>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      <span>Орлого: ₮{Number(w.total_earned).toLocaleString()}</span>
                      <span>Татсан: ₮{Number(w.total_withdrawn).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-bold text-foreground">₮{Number(w.balance).toLocaleString()}</p>
                    <Button variant="ghost" size="icon" onClick={() => setViewDriverId(w.driver_user_id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Requests tab */}
      {tab === "requests" && (
        <div className="space-y-2">
          {!requests?.length ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Хүсэлт байхгүй</div>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground text-sm">{getDriverName(r.driver_user_id)}</p>
                    <p className="text-lg font-bold text-foreground">₮{Number(r.amount).toLocaleString()}</p>
                    {r.note && (
                      <span className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        <Store className="h-3 w-3" />
                        {r.note}
                      </span>
                    )}
                    {r.bank_name && <p className="text-xs text-muted-foreground">{r.bank_name} — {r.bank_account}</p>}
                  </div>
                  <Badge
                    variant={
                      r.status === "completed" ? "default" :
                      r.status === "rejected" ? "destructive" :
                      r.status === "approved" ? "secondary" : "outline"
                    }
                  >
                    {WITHDRAWAL_STATUS_LABELS[r.status] || r.status}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString("mn-MN")}</p>

                <div className="flex flex-wrap gap-2">
                  {r.status === "pending" && (
                    <>
                      <Button size="sm" variant="default" onClick={() => handleRequestAction(r.id, r.driver_user_id, Number(r.amount), "completed")}>
                        <ArrowRight className="h-3 w-3 mr-1" />
                        Шилжүүлэх
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleRequestAction(r.id, r.driver_user_id, Number(r.amount), "rejected")}>
                        Татгалзах
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleDownloadInvoice(r)}>
                    <FileDown className="h-3 w-3 mr-1" />
                    Нэхэмжлэл PDF
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Settings tab */}
      {tab === "settings" && settings && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <h3 className="font-medium text-foreground">Хэтэвч тохиргоо</h3>
          <div className="space-y-2">
            <Label>Нэг хүргэлтийн орлого (₮)</Label>
            <Input
              type="number"
              defaultValue={settings.delivery_fee_per_order}
              onChange={(e) => setFee(e.target.value)}
              placeholder="8000"
            />
            <p className="text-xs text-muted-foreground">Жолооч хүргэлт амжилттай хийх бүрт энэ дүн хэтэвчинд нэмэгдэнэ.</p>
          </div>
          <Button onClick={handleSaveSettings} disabled={updateSettings.isPending}>
            Хадгалах
          </Button>
        </div>
      )}

      {/* Transaction detail dialog */}
      <Dialog open={!!viewDriverId} onOpenChange={(open) => { if (!open) setViewDriverId(null); }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewDriverId ? getDriverName(viewDriverId) : ""} — Гүйлгээний түүх</DialogTitle>
          </DialogHeader>
          {viewDriverId && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">Дэлгүүр тус бүрийн орлого</h4>
              <ShopEarningsBreakdown driverUserId={viewDriverId} />
            </div>
          )}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Гүйлгээний түүх</h4>
            {!viewTxs?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">Гүйлгээ байхгүй</p>
            ) : (
              viewTxs.map((tx) => {
                const isPositive = tx.type === "delivery_earning" || tx.type === "adjustment_add";
                return (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{TX_TYPE_LABELS[tx.type] || tx.type}</p>
                      {tx.description && <p className="text-xs text-muted-foreground truncate">{tx.description}</p>}
                      <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleString("mn-MN")}</p>
                    </div>
                    <div className="text-right ml-3">
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
