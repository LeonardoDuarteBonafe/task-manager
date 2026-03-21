"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "@/components/theme/theme-provider";
import { isForcedUser } from "@/lib/mock-mode";
import { cn } from "@/lib/utils";
import { Button } from "./button";
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
      Tema: {theme === "dark" ? "Escuro" : "Claro"}
    </Button>
  );
}

export function AppShell({ title, subtitle, actions, children, showPageHeader = true }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const forcedMode = isForcedUser(data?.user);

  const userLabel = useMemo(() => data?.user?.name || data?.user?.email || "Usuario", [data?.user?.email, data?.user?.name]);

  const navigation = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-1">
        <Link className="inline-flex items-center text-lg font-semibold text-slate-900 transition hover:text-slate-700 dark:text-slate-100 dark:hover:text-slate-300" href="/" onClick={() => setMobileMenuOpen(false)}>
          Task Manager
        </Link>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {data?.user?.email ? `Conectado como ${data.user.email}` : "Gerencie suas rotinas recorrentes."}
        </p>
        {forcedMode ? (
          <p className="mt-3 rounded-2xl bg-amber-100 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
            Modo forcado ativo: alguns dados sao simulados e podem aparecer limitados.
          </p>
        ) : null}
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
        <nav className="flex flex-col gap-2 pb-4">
          {links.map((link) => {
            const active = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm font-medium transition",
                  active
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900/80",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="shrink-0 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <ThemeSwitchButton />
        {data?.user ? (
          <Button className="w-full justify-center" onClick={() => signOut({ callbackUrl: "/login" })} type="button" variant="ghost">
            Sair
          </Button>
        ) : null}
      </div>
    </div>
  );

  return (
    <main className="flex h-screen w-full overflow-hidden">
      <aside className="hidden h-screen w-72 shrink-0 border-r border-slate-200 bg-white/85 px-5 py-5 backdrop-blur md:block dark:border-slate-800 dark:bg-slate-950/80">
        {navigation}
      </aside>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm md:hidden">
          <button aria-label="Fechar menu" className="absolute inset-0" onClick={() => setMobileMenuOpen(false)} type="button" />
          <aside className="relative z-10 flex h-full w-80 max-w-[86vw] flex-col border-r border-slate-200 bg-white px-5 py-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            {navigation}
          </aside>
        </div>
      ) : null}

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur md:px-6 dark:border-slate-800 dark:bg-slate-950/70">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button className="px-3 md:hidden" onClick={() => setMobileMenuOpen(true)} type="button" variant="secondary">
                Menu
              </Button>
              <Link className="truncate text-lg font-semibold text-slate-900 transition hover:text-slate-700 dark:text-slate-100 dark:hover:text-slate-300" href="/">
                Task Manager
              </Link>
            </div>

            <button
              aria-label="Abrir Meu Perfil"
              className="rounded-full transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-700"
              onClick={() => router.push("/meu-perfil")}
              type="button"
            >
              <UserAvatar image={data?.user?.image} name={userLabel} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
            {showPageHeader ? (
              <header className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
                    {subtitle ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p> : null}
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
