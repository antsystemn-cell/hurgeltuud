import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useSendTelegramTest } from "@/hooks/useOrders";
import { Pencil, Trash2, KeyRound, Shield, Send } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  main_admin: "Админ",
  operator: "Оператор",
  driver: "Жолооч",
};

interface UserRow {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  active: boolean;
  created_at: string;
  roles: string[];
}

export default function UserManagement() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();

  // Create form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<string>("operator");

  // Edit dialog
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  // Role dialog
  const [roleUser, setRoleUser] = useState<UserRow | null>(null);
  const [newRole, setNewRole] = useState("");

  // Password dialog
  const [pwUser, setPwUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // Delete dialog
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);

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
      })) as UserRow[];
    },
  });

  const createUser = useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke("admin-create-user", {
        body: { email, password, full_name: fullName, role, phone: phone || undefined },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Хэрэглэгч амжилттай үүсгэлээ");
      setEmail(""); setPassword(""); setFullName(""); setPhone("");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const manageUser = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      const response = await supabase.functions.invoke("admin-manage-user", { body });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const handleEdit = () => {
    if (!editUser) return;
    manageUser.mutate(
      { action: "update_profile", user_id: editUser.user_id, full_name: editName, phone: editPhone },
      { onSuccess: () => { toast.success("Мэдээлэл шинэчлэгдлээ"); setEditUser(null); } }
    );
  };

  const handleRoleChange = () => {
    if (!roleUser || !newRole) return;
    manageUser.mutate(
      { action: "update_role", user_id: roleUser.user_id, role: newRole },
      { onSuccess: () => { toast.success("Эрх шинэчлэгдлээ"); setRoleUser(null); } }
    );
  };

  const handlePasswordReset = () => {
    if (!pwUser || !newPassword) return;
    manageUser.mutate(
      { action: "reset_password", user_id: pwUser.user_id, new_password: newPassword },
      { onSuccess: () => { toast.success("Нууц үг шинэчлэгдлээ"); setPwUser(null); setNewPassword(""); } }
    );
  };

  const handleDelete = () => {
    if (!deleteUser) return;
    manageUser.mutate(
      { action: "delete_user", user_id: deleteUser.user_id },
      { onSuccess: () => { toast.success("Хэрэглэгч устгагдлаа"); setDeleteUser(null); } }
    );
  };

  const isSelf = (u: UserRow) => u.user_id === currentUser?.id;

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
            <Label>Утас</Label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="99001122" />
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
        <Button onClick={() => createUser.mutate()} disabled={createUser.isPending || (!email && !phone) || !password}>
          Үүсгэх
        </Button>
      </div>

      {/* User list */}
      {isLoading ? (
        <p className="text-muted-foreground">Уншиж байна...</p>
      ) : (
        <div className="space-y-2">
          {users?.map((u) => (
            <div key={u.id} className="bg-card border border-border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{u.full_name || "—"}</p>
                <p className="text-xs text-muted-foreground truncate">{u.phone || "Утас байхгүй"}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  u.roles.includes("main_admin")
                    ? "bg-primary/10 text-primary"
                    : u.roles.includes("operator")
                    ? "bg-accent text-accent-foreground"
                    : u.roles.includes("driver")
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-destructive/10 text-destructive"
                }`}>
                  {u.roles.map(r => ROLE_LABELS[r] || r).join(", ") || "Эрхгүй"}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  title="Засах"
                  onClick={() => { setEditUser(u); setEditName(u.full_name); setEditPhone(u.phone || ""); }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  title="Эрх солих"
                  disabled={isSelf(u)}
                  onClick={() => { setRoleUser(u); setNewRole(u.roles[0] || "operator"); }}
                >
                  <Shield className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  title="Нууц үг солих"
                  onClick={() => { setPwUser(u); setNewPassword(""); }}
                >
                  <KeyRound className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                  title="Устгах"
                  disabled={isSelf(u)}
                  onClick={() => setDeleteUser(u)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Хэрэглэгч засах</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Нэр</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Утас</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Болих</Button>
            <Button onClick={handleEdit} disabled={manageUser.isPending}>Хадгалах</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={!!roleUser} onOpenChange={(o) => !o && setRoleUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Эрх солих — {roleUser?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Шинэ эрх</Label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="main_admin">Админ</SelectItem>
                <SelectItem value="operator">Оператор</SelectItem>
                <SelectItem value="driver">Жолооч</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleUser(null)}>Болих</Button>
            <Button onClick={handleRoleChange} disabled={manageUser.isPending}>Хадгалах</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={!!pwUser} onOpenChange={(o) => !o && setPwUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Нууц үг солих — {pwUser?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Шинэ нууц үг</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwUser(null)}>Болих</Button>
            <Button onClick={handlePasswordReset} disabled={manageUser.isPending || !newPassword}>Хадгалах</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Хэрэглэгч устгах</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteUser?.full_name || "—"}</strong> хэрэглэгчийг бүрмөсөн устгах уу? Энэ үйлдлийг буцаах боломжгүй.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Болих</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Устгах
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
