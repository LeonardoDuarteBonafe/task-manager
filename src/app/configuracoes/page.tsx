"use client";

import { AppShell } from "@/components/ui/app-shell";
import { NotificationPermissionCard } from "@/components/notifications/notification-permission-card";
import { Card } from "@/components/ui/card";

export default function ConfiguracoesPage() {
  return (
    <AppShell subtitle="Area de testes para o fluxo inicial de notificacoes." title="Configuracoes">
      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Centro de configuracoes</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Centralize testes e estado atual das notificacoes em um unico lugar.
          </p>
        </div>
      </Card>
      <NotificationPermissionCard mode="settings" />
    </AppShell>
  );
}
