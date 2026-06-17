import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useMyProfile, useUpdateBankInfo } from "@/hooks/useProfile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { User, Landmark } from "lucide-react";

export default function DriverProfile() {
  const { user } = useAuth();
  const userId = user?.id || "";
  const { data: profile, isLoading } = useMyProfile(userId);
  const updateBank = useUpdateBankInfo(userId);

  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankHolder, setBankHolder] = useState("");

  useEffect(() => {
    if (profile) {
      setBankName(profile.bank_name || "");
      setBankAccount(profile.bank_account || "");
      setBankHolder(profile.bank_account_holder || "");
    }
  }, [profile]);

  const handleSave = () => {
    if (!bankName.trim() || !bankAccount.trim()) {
      toast({ title: "Дутуу мэдээлэл", description: "Банкны нэр болон дансны дугаар оруулна уу", variant: "destructive" });
      return;
    }
    updateBank.mutate(
      { bank_name: bankName, bank_account: bankAccount, bank_account_holder: bankHolder },
      {
        onSuccess: () => toast({ title: "Хадгалагдлаа", description: "Дансны мэдээлэл шинэчлэгдлээ" }),
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : "Дахин оролдоно уу";
          toast({ title: "Алдаа гарлаа", description: message, variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return <div className="p-4 text-center text-muted-foreground">Уншиж байна...</div>;
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {/* Identity card */}
      <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground truncate">{profile?.full_name || "Жолооч"}</p>
          {profile?.phone && <p className="text-sm text-muted-foreground">{profile.phone}</p>}
        </div>
      </div>

      {/* Bank info form */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Дансны мэдээлэл</h2>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Энд хадгалсан дансны мэдээлэл мөнгө татах хүсэлт дээр автоматаар бөглөгдөнө.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="bankName" className="text-xs">Банкны нэр</Label>
          <Input id="bankName" placeholder="Жишээ: Хаан банк" value={bankName} onChange={(e) => setBankName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bankAccount" className="text-xs">Дансны дугаар</Label>
          <Input id="bankAccount" inputMode="numeric" placeholder="Дансны дугаар" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bankHolder" className="text-xs">Данс эзэмшигчийн нэр</Label>
          <Input id="bankHolder" placeholder="Данс эзэмшигчийн нэр" value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} />
        </div>

        <Button className="w-full" onClick={handleSave} disabled={updateBank.isPending}>
          {updateBank.isPending ? "Хадгалж байна..." : "Хадгалах"}
        </Button>
      </div>
    </div>
  );
}
