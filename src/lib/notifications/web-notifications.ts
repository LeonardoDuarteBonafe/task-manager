export function isNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function isServiceWorkerSupported() {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

export function getNotificationPermission() {
  if (!isNotificationSupported()) {
    return "unsupported" as const;
  }

  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    return "unsupported" as const;
  }

  return Notification.requestPermission();
}

export async function getNotificationServiceWorkerRegistration() {
  if (!isServiceWorkerSupported()) {
    return null;
  }

  const registration = await navigator.serviceWorker.getRegistration();

  if (registration) {
    return registration;
  }

  const readyOrTimeout = await Promise.race([
    navigator.serviceWorker.ready.then((readyRegistration) => readyRegistration),
    new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), 1200);
    }),
  ]);

  return readyOrTimeout;
}

export async function showNotificationPreview(title: string, body: string) {
  if (getNotificationPermission() !== "granted") {
    return false;
  }

  const registration = await getNotificationServiceWorkerRegistration();

  if (registration) {
    await registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
      tag: "taskmanager-preview",
    });

    return true;
  }

  if (typeof window !== "undefined" && "Notification" in window) {
    new Notification(title, {
      body,
      icon: "/icons/icon-192.svg",
      tag: "taskmanager-preview",
    });

    return true;
  }

  return false;
}
