"use client";

import { useEffect } from "react";

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
