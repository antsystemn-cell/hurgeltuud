import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function UserManagement() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("operator");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: roles } = await supabase.from("user_roles").select("*");
      return profiles.map((p) => ({
        ...p,
        roles: roles?.filter((r) => r.user_id === p.user_id).map((r) => r.role) || [],
      }));
    },
  });

  const createUser = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Нэвтрээгүй байна");

      const response = await supabase.functions.invoke("admin-create-user", {
        body: { email, password, full_name: fullName, role },
      });

      if (response.error) {
        throw new Error(response.error.message || "Хэрэглэгч үүсгэхэд алдаа гарлаа");
      }

      const result = response.data;
      if (result?.error) {
        throw new Error(result.error);
      }

      return result;
    },
    onSuccess: () => {
      toast.success("Хэрэглэгч амжилттай үүсгэлээ");
      setEmail("");
      setPassword("");
      setFullName("");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold text-foreground">Хэрэглэгчид</h2>

      {/* Create form */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Шинэ хэрэглэгч</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Нэр</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Имэйл</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Нууц үг</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Эрх</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="main_admin">Админ</SelectItem>
                <SelectItem value="operator">Оператор</SelectItem>
                <SelectItem value="driver">Жолооч</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={() => createUser.mutate()} disabled={createUser.isPending || !email || !password}>
          Үүсгэх
        </Button>
      </div>

      {/* User list */}
      {isLoading ? (
        <p className="text-muted-foreground">Уншиж байна...</p>
      ) : (
        <div className="space-y-2">
          {users?.map((u) => (
            <div key={u.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{u.full_name || "—"}</p>
                <p className="text-xs text-muted-foreground">{u.user_id}</p>
              </div>
              <div className="text-xs text-muted-foreground">
                {u.roles.join(", ") || "Эрхгүй"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
