import type { Metadata, Viewport } from "next";
import "./globals.css";
import { auth } from "@/auth";
import { Providers } from "./providers";
import { PwaBootstrap } from "@/components/pwa/pwa-bootstrap";

export const metadata: Metadata = {
  title: "TaskManager",
  description: "PWA de gerenciamento de tarefas recorrentes",
  applicationName: "TaskManager",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TaskManager",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/icon-192.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default async function RootLayout({ children }: RootLayoutProps) {
  const session = await auth();

  return (
    <html lang="pt-BR">
      <body>
        <Providers session={session}>{children}</Providers>
        <PwaBootstrap />
      </body>
    </html>
  );
}
