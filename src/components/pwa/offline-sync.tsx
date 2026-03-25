"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { bootstrapOfflineData, hydrateOfflineRuntimeState, synchronizeOfflineData } from "@/lib/offline/offline-store";

export function OfflineSync() {
  const { status, data: session } = useSession();
  const userId = session?.user?.id;

  useEffect(() => {
    if (status !== "authenticated" || !userId) {
      return;
    }

    const runSync = () => {
      void synchronizeOfflineData(userId, "foreground-sync");
    };
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "taskmanager-sync-request") {
        runSync();
      }
    };
    const handleOnlineStateChange = () => {
      void hydrateOfflineRuntimeState();
      runSync();
    };
    const handleOfflineStateChange = () => {
      void hydrateOfflineRuntimeState();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        runSync();
      }
    };

    void bootstrapOfflineData(userId);
    window.addEventListener("online", handleOnlineStateChange);
    window.addEventListener("offline", handleOfflineStateChange);
    window.addEventListener("focus", runSync);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    navigator.serviceWorker?.addEventListener("message", handleServiceWorkerMessage);

    return () => {
      window.removeEventListener("online", handleOnlineStateChange);
      window.removeEventListener("offline", handleOfflineStateChange);
      window.removeEventListener("focus", runSync);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      navigator.serviceWorker?.removeEventListener("message", handleServiceWorkerMessage);
    };
  }, [status, userId]);

  return null;
}
