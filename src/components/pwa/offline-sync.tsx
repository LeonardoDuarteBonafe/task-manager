"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { warmOfflineRoutes } from "@/components/pwa/pwa-bootstrap";
import { OFFLINE_SUPPORTED_ROUTES } from "@/lib/offline/config";
import { bootstrapOfflineData, clearOfflineUserData, hasCompletedOfflineBootstrap, hydrateOfflineRuntimeState, synchronizeOfflineData } from "@/lib/offline/offline-store";
import { clearOfflineAuthSession, saveOfflineAuthSession } from "@/lib/offline/user-session";

export function OfflineSync() {
  const router = useRouter();
  const { status, data: session } = useSession();
  const userId = session?.user?.id;
  const lastBootstrapUserId = useRef<string | null>(null);

  const prefetchAuthenticatedRoutes = useCallback(() => {
    for (const route of OFFLINE_SUPPORTED_ROUTES) {
      if (route === "/") {
        continue;
      }

      router.prefetch(route);
    }
  }, [router]);

  useEffect(() => {
    if (status === "authenticated" && userId) {
      saveOfflineAuthSession({
        user: {
          id: userId,
          email: session?.user?.email ?? null,
          name: session?.user?.name ?? null,
          image: session?.user?.image ?? null,
        },
        expiresAt: session?.expires ?? null,
        persistedAt: new Date().toISOString(),
      });
      return;
    }

    if (status === "unauthenticated" && navigator.onLine) {
      clearOfflineAuthSession();
      void clearOfflineUserData();
    }
  }, [session?.expires, session?.user?.email, session?.user?.image, session?.user?.name, status, userId]);

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

    void (async () => {
      const bootstrapAlreadyCompleted = await hasCompletedOfflineBootstrap(userId);
      const shouldBootstrap = lastBootstrapUserId.current !== userId || !bootstrapAlreadyCompleted;

      if (shouldBootstrap) {
        lastBootstrapUserId.current = userId;
        await bootstrapOfflineData(userId);
        await warmOfflineRoutes();
        prefetchAuthenticatedRoutes();
        return;
      }

      await warmOfflineRoutes();
      prefetchAuthenticatedRoutes();
      await hydrateOfflineRuntimeState();
    })();

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
  }, [prefetchAuthenticatedRoutes, status, userId]);

  return null;
}
