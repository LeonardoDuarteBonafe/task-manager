"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { removeDevicePushSubscription } from "@/lib/notifications/web-notifications";
import { clearOfflineUserData } from "@/lib/offline/offline-store";
import { clearOfflineAuthSession, readOfflineAuthSession } from "@/lib/offline/user-session";
import { AUTH_INVALID_EVENT } from "@/lib/http-client";

export function AuthSessionSync() {
  useEffect(() => {
    const handleInvalidSession = () => {
      const offlineSession = readOfflineAuthSession();
      if (offlineSession?.user?.id) {
        void removeDevicePushSubscription(offlineSession.user.id).catch(() => false);
      }
      clearOfflineAuthSession();
      void clearOfflineUserData();
      void signOut({ callbackUrl: "/login" });
    };

    window.addEventListener(AUTH_INVALID_EVENT, handleInvalidSession);
    return () => window.removeEventListener(AUTH_INVALID_EVENT, handleInvalidSession);
  }, []);

  return null;
}
