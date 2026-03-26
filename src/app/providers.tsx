"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { AuthSessionSync } from "@/components/auth/auth-session-sync";
import { OccurrenceNotificationScheduler } from "@/components/notifications/occurrence-notification-scheduler";
import { OfflineSync } from "@/components/pwa/offline-sync";
import { ThemeProvider } from "@/components/theme/theme-provider";

type ProvidersProps = {
  children: React.ReactNode;
  session: Session | null;
};

export function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider refetchOnWindowFocus session={session}>
      <ThemeProvider>
        {children}
        <AuthSessionSync />
        <OfflineSync />
        <OccurrenceNotificationScheduler />
      </ThemeProvider>
    </SessionProvider>
  );
}
