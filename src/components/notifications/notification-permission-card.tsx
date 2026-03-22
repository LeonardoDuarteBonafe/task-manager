"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  disableNotifications,
  enableNotifications,
  getNotificationPermission,
  getNotificationsEnabled,
  isNotificationSupported,
  isServiceWorkerSupported,
  showTaskNotificationPreview,
} from "@/lib/notifications/web-notifications";

type PermissionState = NotificationPermission | "unsupported";

type NotificationPermissionCardProps = {
  mode?: "compact" | "settings";
};

function getPermissionLabel(permission: PermissionState) {
  if (permission === "granted") return "Permitido";
  if (permission === "denied") return "Negado";
  if (permission === "default") return "Ainda nao decidido";
  return "Nao suportado";
}

function getPermissionMessage(permission: PermissionState, notificationsEnabled: boolean) {
  if (permission === "unsupported") {
    return "Este navegador nao oferece suporte a notificacoes web. O restante do aplicativo continua funcionando normalmente.";
  }

  if (permission === "denied") {
    return "As notificacoes foram bloqueadas neste navegador. Para reativar, ajuste a permissao nas configuracoes do site.";
  }

  if (permission === "granted" && notificationsEnabled) {
    return "Notificacoes habilitadas para o aplicativo. Voce pode desligar esse comportamento a qualquer momento por aqui.";
  }

  if (permission === "granted") {
    return "A permissao do navegador ja foi concedida. Agora voce pode habilitar as notificacoes do aplicativo com um clique.";
  }

  return "Ative as notificacoes para preparar o aplicativo para lembretes futuros no desktop e no mobile.";
}

function getBadgeClasses(permission: PermissionState) {
  if (permission === "granted") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (permission === "denied") return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
  if (permission === "default") return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  return "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200";
}

export function NotificationPermissionCard({ mode = "settings" }: NotificationPermissionCardProps) {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const notificationSupported = isNotificationSupported();
  const serviceWorkerSupported = isServiceWorkerSupported();

  useEffect(() => {
    setPermission(getNotificationPermission());
    setEnabled(getNotificationsEnabled());
  }, []);

  const message = useMemo(() => getPermissionMessage(permission, enabled), [enabled, permission]);

  const canToggle = notificationSupported && permission !== "unsupported";
  const buttonLabel = permission === "granted" && enabled ? "Desabilitar notificacoes" : "Habilitar notificacoes";

  async function handleToggleNotifications() {
    setLoading(true);
    setFeedback(null);

    try {
      if (permission === "granted" && enabled) {
        disableNotifications();
        setEnabled(false);
        setFeedback("Notificacoes do aplicativo desabilitadas.");
        return;
      }

      const nextPermission = await enableNotifications();
      setPermission(nextPermission);
      const nextEnabled = getNotificationsEnabled();
      setEnabled(nextEnabled);

      if (nextPermission === "granted" && nextEnabled) {
        setFeedback("Notificacoes habilitadas com sucesso.");
      } else if (nextPermission === "denied") {
        setFeedback("A permissao foi negada neste navegador.");
      } else if (nextPermission === "unsupported") {
        setFeedback("Este navegador nao suporta notificacoes web.");
      } else {
        setFeedback("A permissao ainda nao foi concedida.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleTestNotification() {
    setLoading(true);
    setFeedback(null);

    try {
      const shown = await showTaskNotificationPreview("Tomar remedio", "08:00");
      setFeedback(shown ? "Notificacao disparada com sucesso." : "Nao foi possivel exibir a notificacao. Verifique permissao e estado atual.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Notificacoes</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>
        </div>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getBadgeClasses(permission)}`}>
          {getPermissionLabel(permission)}
        </span>
      </div>

      <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-400 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
          <span className="font-medium text-slate-900 dark:text-slate-100">Navegador:</span> {notificationSupported ? "suportado" : "nao suportado"}
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
          <span className="font-medium text-slate-900 dark:text-slate-100">Service worker:</span> {serviceWorkerSupported ? "disponivel" : "indisponivel"}
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
          <span className="font-medium text-slate-900 dark:text-slate-100">Aplicativo:</span> {enabled ? "habilitado" : "desabilitado"}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {canToggle ? (
          <Button disabled={loading} onClick={handleToggleNotifications} type="button" variant={permission === "granted" && enabled ? "secondary" : "primary"}>
            {loading ? "Processando..." : buttonLabel}
          </Button>
        ) : null}
        {mode === "settings" ? (
          <Button disabled={loading || permission !== "granted" || !enabled} onClick={handleTestNotification} type="button" variant="contrast">
            Testar notificacao
          </Button>
        ) : null}
      </div>

      {feedback ? <p className="text-sm text-slate-600 dark:text-slate-400">{feedback}</p> : null}
    </Card>
  );
}
