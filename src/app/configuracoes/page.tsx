"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getNotificationPermission,
  requestNotificationPermission,
  showNotificationPreview,
} from "@/lib/notifications/web-notifications";

export default function ConfiguracoesPage() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  async function handlePermissionRequest() {
    setLoading(true);
    setFeedback(null);
    try {
      const nextPermission = await requestNotificationPermission();
      setPermission(nextPermission);
      setFeedback(nextPermission === "granted" ? "Permissao concedida com sucesso." : "A permissao nao foi concedida.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTestNotification() {
    setLoading(true);
    setFeedback(null);

    try {
      const shown = await showNotificationPreview("TaskManager", "Esta e uma notificacao de teste do ambiente atual.");
      setFeedback(shown ? "Notificacao disparada com sucesso." : "Nao foi possivel exibir a notificacao. Verifique a permissao.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell subtitle="Area de testes para o fluxo inicial de notificacoes." title="Configuracoes">
      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Notificacoes em modo de teste</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Verifique permissao, solicite acesso ao navegador e simule um disparo local.
          </p>
        </div>

        <div className="grid gap-3 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900">Permissao atual: {permission}</div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900">Fluxo push com VAPID: preparado para a proxima etapa</div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={loading} onClick={handlePermissionRequest} type="button" variant="secondary">
            Verificar permissao de push
          </Button>
          <Button disabled={loading} onClick={handleTestNotification} type="button">
            Testar notificacao
          </Button>
        </div>

        {feedback ? <p className="text-sm text-slate-600 dark:text-slate-400">{feedback}</p> : null}
      </Card>
    </AppShell>
  );
}
