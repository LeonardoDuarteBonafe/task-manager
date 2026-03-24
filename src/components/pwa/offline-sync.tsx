"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { flushOfflineQueue } from "@/lib/offline/offline-store";

export function OfflineSync() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    const runSync = () => {
      void flushOfflineQueue();
    };
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "taskmanager-sync-request") {
        runSync();
      }
    };

    runSync();
    window.addEventListener("online", runSync);
    window.addEventListener("focus", runSync);
    document.addEventListener("visibilitychange", runSync);
    navigator.serviceWorker?.addEventListener("message", handleServiceWorkerMessage);

    return () => {
      window.removeEventListener("online", runSync);
      window.removeEventListener("focus", runSync);
      document.removeEventListener("visibilitychange", runSync);
      navigator.serviceWorker?.removeEventListener("message", handleServiceWorkerMessage);
    };
  }, [status]);

  return null;
}
