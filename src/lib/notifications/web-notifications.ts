import { buildOccurrenceNotificationContent } from "@/lib/notifications/occurrence-notification-content";

const NOTIFICATIONS_ENABLED_KEY = "taskmanager-notifications-enabled";
const NOTIFICATION_ICON = "/icons/icon-192.svg";
export const NOTIFICATIONS_SETTINGS_CHANGED_EVENT = "taskmanager:notifications-settings-changed";

export type NotificationChannel = "desktop" | "mobile";

type BrowserNotificationOptions = {
  channel?: NotificationChannel;
  notificationId?: string;
  url?: string;
  occurrenceId?: string;
  userId?: string;
  actions?: Array<{
    action: string;
    title: string;
  }>;
};

type PushSubscriptionPayload = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export function isNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function isServiceWorkerSupported() {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

export function isPushManagerSupported() {
  return typeof window !== "undefined" && isServiceWorkerSupported() && "PushManager" in window;
}

export function isBackgroundPushAvailable() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) && isPushManagerSupported();
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

function decodeBase64Url(base64Url: string) {
  const normalized = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const base64 = normalized + padding;
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function mapPushSubscriptionPayload(subscription: PushSubscription): PushSubscriptionPayload {
  const json = subscription.toJSON();

  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: {
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
  };
}

export async function getCurrentPushSubscription() {
  if (!isBackgroundPushAvailable()) {
    return null;
  }

  const registration = await getNotificationServiceWorkerRegistration();

  if (!registration) {
    return null;
  }

  return registration.pushManager.getSubscription();
}

export async function ensureDevicePushSubscription(userId: string, deviceLabel?: string) {
  if (!isBackgroundPushAvailable()) {
    return null;
  }

  const registration = await getNotificationServiceWorkerRegistration();

  if (!registration) {
    return null;
  }

  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription =
    existingSubscription ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    }));

  const payload = mapPushSubscriptionPayload(subscription);

  const response = await fetch("/api/notifications/push-subscriptions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      subscription: payload,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      deviceLabel,
    }),
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel registrar este dispositivo para Web Push.");
  }

  return subscription;
}

export async function removeDevicePushSubscription(userId: string) {
  const subscription = await getCurrentPushSubscription();

  if (!subscription) {
    return false;
  }

  const endpoint = subscription.endpoint;

  const response = await fetch("/api/notifications/push-subscriptions", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      endpoint,
    }),
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel remover este dispositivo das notificacoes em segundo plano.");
  }

  await subscription.unsubscribe();
  return true;
}

export async function hasActiveCurrentDevicePushSubscription(userId: string) {
  const subscription = await getCurrentPushSubscription();

  if (!subscription) {
    return false;
  }

  const response = await fetch(
    `/api/notifications/push-subscriptions?userId=${encodeURIComponent(userId)}&endpoint=${encodeURIComponent(subscription.endpoint)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return false;
  }

  const payload = (await response.json()) as {
    success: boolean;
    data?: {
      currentDeviceSubscribed?: boolean;
    };
  };

  return payload.success === true && payload.data?.currentDeviceSubscribed === true;
}

function createNotificationId(channel: NotificationChannel) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${channel}-${crypto.randomUUID()}`;
  }

  return `${channel}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildNotificationOptions(body: string, notificationId: string, options: Pick<BrowserNotificationOptions, "actions" | "occurrenceId" | "url" | "userId"> = {}) {
  return {
    body,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
    actions: options.actions,
    data: {
      notificationId,
      occurrenceId: options.occurrenceId ?? null,
      url: options.url ?? "/dashboard",
      userId: options.userId ?? null,
    },
  };
}

export async function showNotificationPreview(title: string, body: string, options: BrowserNotificationOptions = {}) {
  if (getNotificationPermission() !== "granted" || !getNotificationsEnabled()) {
    return false;
  }

  const channel = options.channel ?? "desktop";
  const notificationId = options.notificationId ?? createNotificationId(channel);
  const notificationOptions = buildNotificationOptions(body, notificationId, options);
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

export function isIosDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isStandaloneDisplayMode() {
  if (typeof window === "undefined") {
    return false;
  }

  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };

  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

export async function showTaskNotificationPreview(
  taskTitle: string,
  scheduledTime: string,
  sentAt = new Date(),
  occurrenceId?: string,
  notificationAttempt = 1,
  userId?: string,
) {
  const content = buildOccurrenceNotificationContent({
    taskTitle,
    scheduledTime,
    sentAt,
    notificationAttempt,
  });

  return showNotificationPreview(content.title, content.body, {
    channel: "desktop",
    occurrenceId,
    userId,
    url: occurrenceId ? `/recorrencias?occurrenceId=${encodeURIComponent(occurrenceId)}` : "/recorrencias",
    actions:
      occurrenceId && userId
        ? [
            { action: "complete", title: "Concluir" },
            { action: "ignore", title: "Ignorar" },
          ]
        : undefined,
  });
}
