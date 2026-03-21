"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "@/components/theme/theme-provider";
import { isForcedUser } from "@/lib/mock-mode";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type AppShellProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

const links = [
  { href: "/dashboard", label: "Painel" },
  { href: "/tasks", label: "Tarefas" },
  { href: "/recorrencias", label: "Recorrencias" },
  { href: "/configuracoes", label: "Configuracoes" },
];

export function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  const pathname = usePathname();
  const { data } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const forcedMode = isForcedUser(data?.user);

  const navigation = (
    <div className="flex h-full flex-col">
      <div className="px-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">TaskManager</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {data?.user?.email ? `Conectado como ${data.user.email}` : "Gerencie suas rotinas recorrentes."}
        </p>
        {forcedMode ? (
          <p className="mt-2 rounded-xl bg-amber-100 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
            Modo forcado ativo: dados simulados e alguns recursos podem ficar limitados.
          </p>
        ) : null}
      </div>
      <nav className="mt-6 flex flex-1 flex-col gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              "rounded-xl px-4 py-3 text-sm font-medium transition",
              pathname === link.href
                ? "bg-slate-900 text-white dark:bg-blue-600"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6 space-y-2">
        <Button className="w-full justify-center" onClick={toggleTheme} type="button" variant="secondary">
          Tema: {theme === "dark" ? "Escuro" : "Claro"}
        </Button>
        {data?.user ? (
          <Button
            className="w-full justify-center"
            onClick={() => signOut({ callbackUrl: "/login" })}
            type="button"
            variant="ghost"
          >
            Sair
          </Button>
        ) : null}
      </div>
    </div>
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl gap-0 px-0 md:px-4 md:py-4">
      <aside className="sticky top-0 hidden h-screen w-72 flex-shrink-0 border-r border-slate-200 bg-white/85 p-5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85 md:block">
        {navigation}
      </aside>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/50 md:hidden">
          <button className="absolute inset-0" onClick={() => setMobileMenuOpen(false)} type="button" />
          <aside className="relative z-10 h-full w-80 max-w-[85vw] border-r border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            {navigation}
          </aside>
        </div>
      ) : null}

      <section className="flex min-h-screen flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        <header className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Button className="md:hidden" onClick={() => setMobileMenuOpen(true)} type="button" variant="secondary">
                Menu
              </Button>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
                {subtitle ? <p className="text-sm text-slate-600 dark:text-slate-400">{subtitle}</p> : null}
              </div>
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
