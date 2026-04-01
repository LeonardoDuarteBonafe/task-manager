"use client";

import type { SVGProps } from "react";
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

type IconProps = SVGProps<SVGSVGElement>;

type NavLink = {
  href: string;
  label: string;
  icon: (props: IconProps) => React.JSX.Element;
};

const SIDEBAR_STORAGE_KEY = "taskmanager-sidebar-collapsed";

function DashboardIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <rect height="7" rx="2" stroke="currentColor" strokeWidth="1.8" width="7" x="3.5" y="3.5" />
      <rect height="11" rx="2" stroke="currentColor" strokeWidth="1.8" width="7" x="13.5" y="3.5" />
      <rect height="9" rx="2" stroke="currentColor" strokeWidth="1.8" width="7" x="3.5" y="13.5" />
      <rect height="5" rx="2" stroke="currentColor" strokeWidth="1.8" width="7" x="13.5" y="17.5" />
    </svg>
  );
}

function TaskIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M8.5 7.5h8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M8.5 12h8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M8.5 16.5h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="m4.5 7.5 1.2 1.2L7.8 6.6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m4.5 12 1.2 1.2L7.8 11.1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m4.5 16.5 1.2 1.2L7.8 15.6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function RecurrenceIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M7 7.5h8.5a3 3 0 0 1 0 6H8.75" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="m13 4.5 3 3-3 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M17 16.5H8.5a3 3 0 1 1 0-6h6.75" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="m11 19.5-3-3 3-3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function SettingsIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M12 8.25a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19 12a7 7 0 0 0-.12-1.3l1.56-1.22-1.5-2.6-1.9.66a7.5 7.5 0 0 0-2.23-1.3l-.3-2.02h-3l-.3 2.02c-.8.25-1.56.68-2.23 1.3l-1.9-.66-1.5 2.6 1.56 1.22a7.3 7.3 0 0 0 0 2.6L4.58 14.5l1.5 2.6 1.9-.66c.67.61 1.43 1.05 2.23 1.3l.3 2.02h3l.3-2.02a7.5 7.5 0 0 0 2.23-1.3l1.9.66 1.5-2.6-1.56-1.2c.08-.43.12-.86.12-1.3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ProfileIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 18.5c1.6-3.2 4.1-4.8 7-4.8s5.4 1.6 7 4.8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function SunIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2.75v2.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M12 18.75v2.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="m5.46 5.46 1.78 1.78" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="m16.76 16.76 1.78 1.78" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M2.75 12h2.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M18.75 12h2.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="m5.46 18.54 1.78-1.78" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="m16.76 7.24 1.78-1.78" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function MoonIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M15.5 3.5a7.9 7.9 0 1 0 5 13.96A9 9 0 1 1 15.5 3.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MenuIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M4 7h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M4 12h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M4 17h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function ChevronLeftIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path d="m14.5 6.5-5 5 5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function ChevronRightIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path d="m9.5 6.5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function LogoutIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M9 5.5H6.75A2.25 2.25 0 0 0 4.5 7.75v8.5a2.25 2.25 0 0 0 2.25 2.25H9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M13.5 8.5 18 12l-4.5 3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M18 12H9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

const links = [
  { href: "/dashboard", label: "Painel", icon: DashboardIcon },
  { href: "/tasks", label: "Tarefas", icon: TaskIcon },
  { href: "/recorrencias", label: "Recorrencias", icon: RecurrenceIcon },
  { href: "/configuracoes", label: "Configuracoes", icon: SettingsIcon },
  { href: "/meu-perfil", label: "Meu Perfil", icon: ProfileIcon },
] satisfies NavLink[];

function ThemeSwitchButton({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const Icon = isDark ? MoonIcon : SunIcon;
  const label = isDark ? "Tema escuro" : "Tema claro";

  return (
    <Button
      aria-label={`Alternar tema. Atual: ${label}`}
      className={cn("w-full", collapsed ? "px-0" : "justify-start")}
      onClick={toggleTheme}
      title={label}
      type="button"
      variant="secondary"
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span
        className={cn(
          "overflow-hidden whitespace-nowrap text-left transition-[max-width,opacity,margin] duration-200",
          collapsed ? "ml-0 max-w-0 opacity-0" : "ml-3 max-w-[10rem] opacity-100",
        )}
      >
        {label}
      </span>
    </Button>
  );
}

export function AppShell({ title, subtitle, actions, children, showPageHeader = true }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useSession();
  const [offlineSession, setOfflineSession] = useState(() => readOfflineAuthSession());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const effectiveUser = data?.user ?? offlineSession?.user;
  const forcedMode = isForcedUser(data?.user ?? undefined);

  useEffect(() => {
    setOfflineSession(readOfflineAuthSession());
  }, [data?.user?.email, data?.user?.id, data?.user?.image, data?.user?.name]);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    setSidebarCollapsed(storedValue === "true");
  }, []);

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

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  }

  function renderNavigation({ compact }: { compact: boolean }) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className={cn("shrink-0", compact ? "px-0" : "px-1")}>
          <div className={cn("flex gap-3", compact ? "justify-center" : "items-start justify-between")}>
            {compact ? (
              <OfflineRouteLink
                aria-label="Ir para a pagina inicial"
                className="relative inline-flex h-12 w-12 items-center justify-center rounded-[1.35rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] font-display text-2xl leading-none text-[var(--foreground)] shadow-[0_10px_30px_rgba(20,16,12,0.08)]"
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                title={forcedMode ? "TaskManager - modo demonstracao ativo" : "TaskManager"}
              >
                T
                {forcedMode ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-400" /> : null}
              </OfflineRouteLink>
            ) : (
              <>
                <div className="min-w-0">
                  <span className="inline-flex rounded-full border border-[var(--border-subtle)] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted-strong)]">
                    Atelier de rotina
                  </span>
                  <OfflineRouteLink
                    className="mt-4 inline-flex items-center font-display text-3xl leading-none text-[var(--foreground)]"
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    title="TaskManager"
                  >
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
              </>
            )}

          </div>
        </div>

        <div className={cn("mt-6 min-h-0 flex-1 overflow-y-auto", compact ? "pr-0" : "pr-1")}>
          <nav className={cn("flex flex-col pb-4", compact ? "gap-3" : "gap-2")}>
            {links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              const Icon = link.icon;

              return (
                <OfflineRouteLink
                  key={link.href}
                  aria-label={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  title={link.label}
                  className={cn(
                    "flex items-center rounded-[1.35rem] border text-sm font-semibold tracking-[0.04em] transition",
                    compact ? "mx-auto h-12 w-12 justify-center px-0 py-0" : "px-4 py-3",
                    active
                      ? "border-transparent bg-[var(--surface-accent)] text-white shadow-[0_18px_35px_rgba(184,79,47,0.22)]"
                      : "border-transparent text-[var(--foreground)] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-card)]",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span
                    className={cn(
                      "overflow-hidden whitespace-nowrap text-left transition-[max-width,opacity,margin] duration-200",
                      compact ? "ml-0 max-w-0 opacity-0" : "ml-3 max-w-[12rem] opacity-100",
                    )}
                  >
                    {link.label}
                  </span>
                </OfflineRouteLink>
              );
            })}
          </nav>
        </div>

        <div className="shrink-0 space-y-2 border-t border-[var(--border-subtle)] pt-4">
          <div className={cn("mt-4", compact && "mx-auto w-12")}>
            <OfflineStatus compact={compact} />
          </div>
          <div className={cn(compact && "mx-auto w-12")}>
            <ThemeSwitchButton collapsed={compact} />
          </div>
          {effectiveUser ? (
            <Button
              aria-label="Sair"
              className={cn("w-full", compact ? "mx-auto h-12 w-12 px-0" : "justify-start")}
              onClick={() => void handleSignOut()}
              title="Sair"
              type="button"
              variant="ghost"
            >
              <LogoutIcon className="h-5 w-5 shrink-0" />
              <span
                className={cn(
                  "overflow-hidden whitespace-nowrap text-left transition-[max-width,opacity,margin] duration-200",
                  compact ? "ml-0 max-w-0 opacity-0" : "ml-3 max-w-[10rem] opacity-100",
                )}
              >
                Sair
              </span>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <main className={cn("min-h-screen w-full transition-[padding] duration-300", sidebarCollapsed ? "md:pl-20" : "md:pl-80")}>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden h-screen shrink-0 border-r border-[var(--border-subtle)] bg-[var(--surface-panel)] py-5 backdrop-blur transition-[width,padding] duration-300 md:block",
          sidebarCollapsed ? "w-20 px-2" : "w-80 px-5",
        )}
      >
        {renderNavigation({ compact: sidebarCollapsed })}
      </aside>
      <button
        aria-label={sidebarCollapsed ? "Expandir menu lateral" : "Colapsar menu lateral"}
        className={cn(
          "fixed top-1/2 z-40 hidden h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--surface-accent-strong)] bg-[var(--surface-accent)] p-0 text-white shadow-[0_18px_38px_rgba(184,79,47,0.35)] transition hover:scale-[1.03] hover:bg-[var(--surface-accent-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] md:inline-flex",
          sidebarCollapsed ? "left-20" : "left-80",
        )}
        onClick={toggleSidebar}
        title={sidebarCollapsed ? "Expandir menu lateral" : "Colapsar menu lateral"}
        type="button"
      >
        {sidebarCollapsed ? <ChevronRightIcon className="h-5 w-5" /> : <ChevronLeftIcon className="h-5 w-5" />}
      </button>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden">
          <button aria-label="Fechar menu" className="absolute inset-0" onClick={() => setMobileMenuOpen(false)} type="button" />
          <aside className="relative z-10 flex h-full w-80 max-w-[86vw] flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-panel)] px-5 py-5 shadow-[var(--shadow-soft)]">
            {renderNavigation({ compact: false })}
          </aside>
        </div>
      ) : null}

      <section className="flex min-w-0 flex-col overflow-hidden">
        <header className="border-b border-[var(--border-subtle)] bg-[var(--surface-panel)] px-4 py-3 backdrop-blur md:px-6">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button className="gap-2 px-3 md:hidden" onClick={() => setMobileMenuOpen(true)} type="button" variant="secondary">
                <MenuIcon className="h-4 w-4" />
                <span>Menu</span>
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
