"use client";

import { NotificationPermissionCard } from "@/components/notifications/notification-permission-card";
import { AppShell } from "@/components/ui/app-shell";
import { Card } from "@/components/ui/card";

export default function ConfiguracoesPage() {
  return (
    <AppShell subtitle="Centro de configuracao para notificacoes e comportamento do PWA." title="Configuracoes">
      <Card className="space-y-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted-strong)]">Ambiente</p>
          <h2 className="mt-3 font-display text-3xl text-[var(--foreground)]">Centro de configuracoes</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Centralize estado atual das notificacoes, valide a disponibilidade do dispositivo e acompanhe o preparo do app para alertas recorrentes.
          </p>
        </div>
      </Card>
      <NotificationPermissionCard mode="settings" />
    </AppShell>
  );
}
