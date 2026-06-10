import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { flushQueue, pendingOfflineCount } from "@/lib/orderSync";

// Auto-replays queued driver actions when connectivity returns and exposes
// how many updates are still waiting, so the UI can reassure the driver.
export function useOfflineSync() {
  const qc = useQueryClient();
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pending, setPending] = useState(0);

  const sync = useCallback(async () => {
    const flushed = await flushQueue();
    setPending(pendingOfflineCount());
    if (flushed > 0) qc.invalidateQueries({ queryKey: ["orders"] });
  }, [qc]);

  useEffect(() => {
    setPending(pendingOfflineCount());

    const handleOnline = () => {
      setOnline(true);
      void sync();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    // Flush anything left over from a previous session on mount.
    void sync();
    // Re-check the queue periodically as a safety net.
    const interval = window.setInterval(() => setPending(pendingOfflineCount()), 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(interval);
    };
  }, [sync]);

  return { online, pending };
}
