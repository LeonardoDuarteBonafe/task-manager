"use client";

import { useEffect } from "react";
import { OFFLINE_FALLBACK_ROUTE, OFFLINE_ROUTE_CACHE, OFFLINE_SUPPORTED_ROUTES } from "@/lib/offline/config";

export async function warmOfflineRoutes() {
  if (!("caches" in window) || !navigator.onLine) {
    return;
  }

  const cache = await window.caches.open(OFFLINE_ROUTE_CACHE);
  const routes = [...OFFLINE_SUPPORTED_ROUTES, OFFLINE_FALLBACK_ROUTE];

  await Promise.all(
    routes.map(async (route) => {
      try {
        const response = await fetch(route, {
          credentials: "include",
          cache: "no-store",
        });

        if (response.ok) {
          await cache.put(route, response.clone());
        }
      } catch {
        // Route warmup is best-effort.
      }
    }),
  );
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ("caches" in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
    }

    return;
  }

  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await warmOfflineRoutes();
  } catch (error) {
    console.error("Falha ao registrar o service worker.", error);
  }
}

export function PwaBootstrap() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);

  return null;
}
