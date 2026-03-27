"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "@/components/theme/theme-provider";
import { OfflineStatus } from "@/components/pwa/offline-status";
import { removeDevicePushSubscription } from "@/lib/notifications/web-notifications";
import { isForcedUser } from "@/lib/mock-mode";
import { clearOfflineUserData } from "@/lib/offline/offline-store";
import { clearOfflineAuthSession, readOfflineAuthSession } from "@/lib/offline/user-session";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { OfflineRouteLink } from "./offline-route-link";
import { UserAvatar } from "./user-avatar";

type AppShellProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  showPageHeader?: boolean;
};

const links = [
  { href: "/dashboard", label: "Painel" },
  { href: "/tasks", label: "Tarefas" },
  { href: "/recorrencias", label: "Recorrencias" },
  { href: "/configuracoes", label: "Configuracoes" },
  { href: "/meu-perfil", label: "Meu Perfil" },
];

function ThemeSwitchButton() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button className="w-full justify-center" onClick={toggleTheme} type="button" variant="secondary">
      Tema {theme === "dark" ? "noturno" : "claro"}
    </Button>
  );
}

export function AppShell({ title, subtitle, actions, children, showPageHeader = true }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useSession();
  const [offlineSession, setOfflineSession] = useState(() => readOfflineAuthSession());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const effectiveUser = data?.user ?? offlineSession?.user;
  const forcedMode = isForcedUser(data?.user ?? undefined);

  useEffect(() => {
    setOfflineSession(readOfflineAuthSession());
  }, [data?.user?.email, data?.user?.id, data?.user?.image, data?.user?.name]);

  const userLabel = useMemo(() => effectiveUser?.name || effectiveUser?.email || "Usuario", [effectiveUser?.email, effectiveUser?.name]);

  async function handleSignOut() {
    if (effectiveUser?.id) {
      await removeDevicePushSubscription(effectiveUser.id).catch(() => false);
    }

    clearOfflineAuthSession();
    await clearOfflineUserData();
    if (navigator.onLine) {
      await signOut({ callbackUrl: "/login" });
      return;
    }

    router.replace("/login");
  }

  const navigation = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-1">
        <span className="inline-flex rounded-full border border-[var(--border-subtle)] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted-strong)]">
          Atelier de rotina
        </span>
        <OfflineRouteLink className="mt-4 inline-flex items-center font-display text-3xl leading-none text-[var(--foreground)]" href="/" onClick={() => setMobileMenuOpen(false)}>
          TaskManager
        </OfflineRouteLink>
        <p className="mt-3 max-w-xs text-sm leading-6 text-[var(--muted)]">
          {effectiveUser?.email ? `Conectado como ${effectiveUser.email}` : "Gerencie suas rotinas recorrentes."}
        </p>
        {forcedMode ? (
          <p className="mt-4 rounded-[1.3rem] border border-amber-300/50 bg-amber-100/80 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            Modo de demonstracao ativo: alguns dados seguem um conjunto simulado.
          </p>
        ) : null}
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
        <nav className="flex flex-col gap-2 pb-4">
          {links.map((link) => {
            const active = pathname === link.href;

            return (
              <OfflineRouteLink
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "rounded-[1.35rem] border px-4 py-3 text-sm font-semibold tracking-[0.04em] transition",
                  active
                    ? "border-transparent bg-[var(--surface-accent)] text-white shadow-[0_18px_35px_rgba(184,79,47,0.22)]"
                    : "border-transparent text-[var(--foreground)] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-card)]",
                )}
              >
                {link.label}
              </OfflineRouteLink>
            );
          })}
        </nav>
      </div>

      <div className="shrink-0 space-y-2 border-t border-[var(--border-subtle)] pt-4">
        <div className="mt-4">
          <OfflineStatus />
        </div>
        <ThemeSwitchButton />
        {effectiveUser ? (
          <Button className="w-full justify-center" onClick={() => void handleSignOut()} type="button" variant="ghost">
            Sair
          </Button>
        ) : null}
      </div>
    </div>
  );

  return (
    <main className="flex min-h-screen w-full overflow-hidden">
      <aside className="hidden h-screen w-80 shrink-0 border-r border-[var(--border-subtle)] bg-[var(--surface-panel)] px-5 py-5 backdrop-blur md:block">
        {navigation}
      </aside>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden">
          <button aria-label="Fechar menu" className="absolute inset-0" onClick={() => setMobileMenuOpen(false)} type="button" />
          <aside className="relative z-10 flex h-full w-80 max-w-[86vw] flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-panel)] px-5 py-5 shadow-[var(--shadow-soft)]">
            {navigation}
          </aside>
        </div>
      ) : null}

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-[var(--border-subtle)] bg-[var(--surface-panel)] px-4 py-3 backdrop-blur md:px-6">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button className="px-3 md:hidden" onClick={() => setMobileMenuOpen(true)} type="button" variant="secondary">
                Menu
              </Button>
              <div className="min-w-0">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-[var(--muted-strong)]">Pulseboard</p>
                <OfflineRouteLink className="truncate font-display text-2xl leading-none text-[var(--foreground)]" href="/">
                  TaskManager
                </OfflineRouteLink>
              </div>
              {subtitle ? <p className="hidden max-w-xl text-sm leading-6 text-[var(--muted)] lg:block">{subtitle}</p> : null}
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden rounded-full border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted-strong)] md:block">
                {title}
              </div>
              <button
                aria-label="Abrir Meu Perfil"
                className="rounded-full ring-offset-2 ring-offset-transparent transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                onClick={() => router.push("/meu-perfil")}
                type="button"
              >
                <UserAvatar image={effectiveUser?.image} name={userLabel} />
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
            {showPageHeader ? (
              <header className="fade-up overflow-hidden rounded-[2rem] border border-[var(--border-strong)] bg-[var(--surface-panel)] p-6 shadow-[var(--shadow-soft)] backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-[var(--muted-strong)]">Painel de comando</p>
                    <h1 className="mt-3 font-display text-4xl leading-none text-[var(--foreground)] md:text-5xl">{title}</h1>
                    {subtitle ? <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)] md:text-base">{subtitle}</p> : null}
                  </div>
                  {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
                </div>
              </header>
            ) : null}

            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
