"use client";

import { SessionProvider } from "next-auth/react";
import { OccurrenceNotificationScheduler } from "@/components/notifications/occurrence-notification-scheduler";
import { ThemeProvider } from "@/components/theme/theme-provider";

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <ThemeProvider>
        {children}
        <OccurrenceNotificationScheduler />
      </ThemeProvider>
    </SessionProvider>
  );
}
