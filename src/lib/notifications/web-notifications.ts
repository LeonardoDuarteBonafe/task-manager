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

  return navigator.serviceWorker.ready;
}

export async function showNotificationPreview(title: string, body: string) {
  const registration = await getNotificationServiceWorkerRegistration();

  if (!registration || getNotificationPermission() !== "granted") {
    return false;
  }

  await registration.showNotification(title, {
    body,
    icon: "/icons/icon-192.svg",
    badge: "/icons/icon-192.svg",
    tag: "taskmanager-preview",
  });

  return true;
}
