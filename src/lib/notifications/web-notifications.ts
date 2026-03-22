const NOTIFICATIONS_ENABLED_KEY = "taskmanager-notifications-enabled";

function formatNotificationSentAt(date: Date) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

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

export function getNotificationsEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  const storedValue = window.localStorage.getItem(NOTIFICATIONS_ENABLED_KEY);

  if (storedValue === null) {
    return getNotificationPermission() === "granted";
  }

  return storedValue === "true";
}

export function setNotificationsEnabled(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(enabled));
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    return "unsupported" as const;
  }

  return Notification.requestPermission();
}

export async function enableNotifications() {
  const currentPermission = getNotificationPermission();

  if (currentPermission === "granted") {
    setNotificationsEnabled(true);
    return "granted" as const;
  }

  const nextPermission = await requestNotificationPermission();

  if (nextPermission === "granted") {
    setNotificationsEnabled(true);
  }

  return nextPermission;
}

export function disableNotifications() {
  setNotificationsEnabled(false);
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
  if (getNotificationPermission() !== "granted" || !getNotificationsEnabled()) {
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

export async function showTaskNotificationPreview(taskTitle: string, scheduledTime: string, sentAt = new Date()) {
  const body = [`Horario: ${scheduledTime}`, `Notificacao enviada em ${formatNotificationSentAt(sentAt)}`].join("\n");

  return showNotificationPreview(taskTitle, body);
}
