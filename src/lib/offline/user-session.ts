"use client";

const OFFLINE_LAST_USER_KEY = "taskmanager-offline-last-user";

type OfflineLastUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

export function saveOfflineLastUser(user: OfflineLastUser) {
  if (typeof window === "undefined" || !user.id) {
    return;
  }

  window.localStorage.setItem(OFFLINE_LAST_USER_KEY, JSON.stringify(user));
}

export function clearOfflineLastUser() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(OFFLINE_LAST_USER_KEY);
}

export function readOfflineLastUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(OFFLINE_LAST_USER_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as OfflineLastUser;
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}
