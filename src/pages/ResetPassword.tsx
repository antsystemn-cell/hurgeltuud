import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/logo.png";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the user lands via the email link.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой.");
      return;
    }
    if (password !== confirm) {
      setError("Нууц үг таарахгүй байна.");
      return;
    }

    setLoading(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }

    setDone(true);
    await supabase.auth.signOut();
    setTimeout(() => navigate("/login"), 2000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center flex flex-col items-center">
          <img src={logo} alt="ON Shop" className="h-20 w-20 mb-3" />
          <h1 className="text-2xl font-semibold text-foreground">Шинэ нууц үг</h1>
          <p className="text-sm text-muted-foreground mt-1">Шинэ нууц үгээ оруулна уу</p>
        </div>

        {done ? (
          <p className="text-center text-sm text-primary">
            Нууц үг амжилттай шинэчлэгдлээ. Нэвтрэх хуудас руу шилжиж байна...
          </p>
        ) : !ready ? (
          <p className="text-center text-sm text-muted-foreground">
            Холбоосыг шалгаж байна... Хэрэв энэ хуудас имэйл доторх холбоосоор нээгдээгүй бол
            дахин нууц үг сэргээх хүсэлт илгээнэ үү.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Шинэ нууц үг</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Нууц үг давтах</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Хадгалж байна..." : "Нууц үг шинэчлэх"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
