import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, Eye, EyeOff } from "lucide-react";
import { usePwaSettings } from "@/hooks/usePwaSettings";
import logo from "@/assets/logo.png";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isPhoneNumber(value: string): boolean {
  const cleaned = value.replace(/[\s\-\(\)]/g, "");
  return /^\+?\d{8,15}$/.test(cleaned);
}

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  // Forgot password
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState("");
  const [resetErr, setResetErr] = useState("");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetErr("");
    setResetMsg("");
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);
    if (error) {
      setResetErr(error.message);
    } else {
      setResetMsg("Нууц үг сэргээх холбоосыг имэйл хаягаар тань илгээлээ.");
    }
  };

  // PWA install prompt
  const { data: pwaSettings } = usePwaSettings();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const installedHandler = () => setIsInstalled(true);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const showPwaButton = pwaSettings?.enabled && deferredPrompt && !isInstalled;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    let email = identifier.trim();

    if (isPhoneNumber(email)) {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("resolve-phone-login", {
        body: { phone: email, password },
      });

      setLoading(false);
      if (fnError || fnData?.error) {
        setError(fnData?.error || fnError?.message || "Нэвтрэх боломжгүй");
        return;
      }

      if (fnData?.session) {
        // Session returned directly from edge function, set it
        await supabase.auth.setSession(fnData.session);
        navigate("/");
        return;
      }

      // Fallback: sign in with resolved email
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
        <div className="text-center flex flex-col items-center">
          <img src={logo} alt="ON Shop" className="h-20 w-20 mb-3" />
          <h1 className="text-2xl font-semibold text-foreground">ON Shop Delivery</h1>
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
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Нэвтэрч байна..." : "Нэвтрэх"}
          </Button>
          <Dialog open={resetOpen} onOpenChange={setResetOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="block w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Нууц үгээ мартсан уу?
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Нууц үг сэргээх</DialogTitle>
                <DialogDescription>
                  Бүртгэлтэй имэйл хаягаа оруулна уу. Бид нууц үг сэргээх холбоос илгээнэ.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Имэйл хаяг</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    placeholder="example@mail.com"
                  />
                </div>
                {resetErr && <p className="text-sm text-destructive">{resetErr}</p>}
                {resetMsg && <p className="text-sm text-primary">{resetMsg}</p>}
                <Button type="submit" className="w-full" disabled={resetLoading}>
                  {resetLoading ? "Илгээж байна..." : "Холбоос илгээх"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </form>


        <Link
          to="/register-driver"
          className="block w-full text-center py-3 px-4 rounded-xl border border-primary/40 bg-primary/5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          Жолоочоор бүртгүүлэх
        </Link>


        {showPwaButton && (
          <button
            onClick={handleInstall}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Апп суулгах</span>
          </button>
        )}
      </div>
    </div>
  );
}
