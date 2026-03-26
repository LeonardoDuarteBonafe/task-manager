"use client";

const OFFLINE_LAST_USER_KEY = "taskmanager-offline-last-user";
const OFFLINE_AUTH_SESSION_KEY = "taskmanager-offline-auth-session";

type OfflineLastUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

type OfflineAuthSession = {
  user: OfflineLastUser & {
    image?: string | null;
  };
  expiresAt: string | null;
  persistedAt: string;
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

export function saveOfflineAuthSession(session: OfflineAuthSession) {
  if (typeof window === "undefined" || !session.user.id) {
    return;
  }

  window.localStorage.setItem(OFFLINE_AUTH_SESSION_KEY, JSON.stringify(session));
  saveOfflineLastUser(session.user);
}

export function clearOfflineAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(OFFLINE_AUTH_SESSION_KEY);
  clearOfflineLastUser();
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

export function readOfflineAuthSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(OFFLINE_AUTH_SESSION_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as OfflineAuthSession;
    if (!parsed?.user?.id) {
      clearOfflineAuthSession();
      return null;
    }

    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now()) {
      clearOfflineAuthSession();
      return null;
    }

    return parsed;
  } catch {
    clearOfflineAuthSession();
    return null;
  }
}

export function hasUsableOfflineAuthSession() {
  return readOfflineAuthSession() !== null;
}

export type { OfflineAuthSession, OfflineLastUser };
