import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function isPhoneNumber(value: string): boolean {
  const cleaned = value.replace(/[\s\-\(\)]/g, "");
  return /^\+?\d{8,15}$/.test(cleaned);
}

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    let email = identifier.trim();

    if (isPhoneNumber(email)) {
      // Look up email by phone number
      const { data, error: lookupError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("phone", email)
        .maybeSingle();

      if (lookupError || !data) {
        setLoading(false);
        setError("Энэ дугаартай хэрэглэгч олдсонгүй");
        return;
      }

      // Get the user's email from auth via a service call isn't possible client-side,
      // so we use a workaround: store email or use admin lookup.
      // Actually we can try to get it from user metadata - but we need the email.
      // Best approach: use edge function to resolve phone -> email
      const { data: fnData, error: fnError } = await supabase.functions.invoke("resolve-phone-login", {
        body: { phone: email, password },
      });

      setLoading(false);
      if (fnError || fnData?.error) {
        setError(fnData?.error || fnError?.message || "Нэвтрэх боломжгүй");
        return;
      }

      // Sign in with the resolved email
      const { error: signInErr } = await signIn(fnData.email, password);
      if (signInErr) {
        setError(signInErr.message);
        return;
      }
      navigate("/");
      return;
    }

    // Regular email login
    const { error: signInErr } = await signIn(email, password);
    setLoading(false);
    if (signInErr) {
      setError(signInErr.message);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">Delivery Platform</h1>
          <p className="text-sm text-muted-foreground mt-1">Нэвтрэх</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier">Имэйл эсвэл утасны дугаар</Label>
            <Input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
              placeholder="example@mail.com эсвэл 99001122"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Нууц үг</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Нэвтэрч байна..." : "Нэвтрэх"}
          </Button>
        </form>
      </div>
    </div>
  );
}
