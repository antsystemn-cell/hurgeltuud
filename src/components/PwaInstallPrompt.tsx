import { useState, useEffect, useCallback } from "react";
import { usePwaSettings } from "@/hooks/usePwaSettings";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const { data: settings } = usePwaSettings();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // Check if already installed
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }
  }, []);

  // Listen for beforeinstallprompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => setIsInstalled(true);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  // Check frequency and decide whether to show
  useEffect(() => {
    if (!settings || !settings.enabled || !deferredPrompt || isInstalled) {
      setShowPrompt(false);
      return;
    }

    const dismissedAt = localStorage.getItem("pwa_prompt_dismissed_at");
    if (dismissedAt) {
      const hoursSince = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60);
      if (hoursSince < settings.prompt_frequency_hours) {
        setShowPrompt(false);
        return;
      }
    }

    setShowPrompt(true);
  }, [settings, deferredPrompt, isInstalled]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem("pwa_prompt_dismissed_at", Date.now().toString());
    setShowPrompt(false);
  }, []);

  if (!showPrompt || !settings) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-2xl shadow-lg p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">{settings.prompt_title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{settings.prompt_message}</p>
            </div>
          </div>
          <button onClick={handleDismiss} className="flex-shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" className="flex-1" onClick={handleInstall}>
            <Download className="h-4 w-4 mr-1" />
            Суулгах
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDismiss}>
            Дараа
          </Button>
        </div>
      </div>
    </div>
  );
}
