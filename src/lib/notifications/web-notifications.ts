const NOTIFICATIONS_ENABLED_KEY = "taskmanager-notifications-enabled";
const NOTIFICATION_ICON = "/icons/icon-192.svg";
export const NOTIFICATIONS_SETTINGS_CHANGED_EVENT = "taskmanager:notifications-settings-changed";

export type NotificationChannel = "desktop" | "mobile";

type BrowserNotificationOptions = {
  channel?: NotificationChannel;
  notificationId?: string;
  url?: string;
};

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

  if (getNotificationPermission() !== "granted") {
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
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_SETTINGS_CHANGED_EVENT, { detail: { enabled } }));
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
  } else {
    setNotificationsEnabled(false);
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

function createNotificationId(channel: NotificationChannel) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${channel}-${crypto.randomUUID()}`;
  }

  return `${channel}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildNotificationOptions(body: string, notificationId: string, url?: string) {
  return {
    body,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
    data: {
      notificationId,
      url: url ?? "/dashboard",
    },
  };
}

export async function showNotificationPreview(title: string, body: string, options: BrowserNotificationOptions = {}) {
  if (getNotificationPermission() !== "granted" || !getNotificationsEnabled()) {
    return false;
  }

  const channel = options.channel ?? "desktop";
  const notificationId = options.notificationId ?? createNotificationId(channel);
  const notificationOptions = buildNotificationOptions(body, notificationId, options.url);
  const registration = await getNotificationServiceWorkerRegistration();

  if (registration) {
    await registration.showNotification(title, notificationOptions);

    return true;
  }

  if (typeof window !== "undefined" && "Notification" in window) {
    const notification = new Notification(title, {
      ...notificationOptions,
    });
    const targetUrl = notificationOptions.data.url;

    notification.onclick = () => {
      window.focus();
      window.location.assign(targetUrl);
      notification.close();
    };

    return true;
  }

  return false;
}

export async function showTaskNotificationPreview(taskTitle: string, scheduledTime: string, sentAt = new Date(), occurrenceId?: string) {
  const body = [`Horario: ${scheduledTime}`, `Notificacao enviada em ${formatNotificationSentAt(sentAt)}`].join("\n");

  return showNotificationPreview(taskTitle, body, {
    channel: "desktop",
    url: occurrenceId ? `/recorrencias?occurrenceId=${encodeURIComponent(occurrenceId)}` : "/recorrencias",
  });
}
