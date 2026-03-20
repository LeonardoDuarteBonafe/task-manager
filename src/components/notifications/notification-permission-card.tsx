"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getNotificationPermission,
  isNotificationSupported,
  isServiceWorkerSupported,
  requestNotificationPermission,
} from "@/lib/notifications/web-notifications";

type PermissionState = NotificationPermission | "unsupported";

function getPermissionLabel(permission: PermissionState) {
  if (permission === "granted") {
    return "Permitido";
  }

  if (permission === "denied") {
    return "Negado";
  }

  if (permission === "default") {
    return "Ainda nao decidido";
  }

  return "Nao suportado";
}

function getPermissionMessage(permission: PermissionState, serviceWorkerSupported: boolean) {
  if (permission === "unsupported") {
    return "Este navegador nao oferece suporte a notificacoes web. O restante do aplicativo continua funcionando normalmente.";
  }

  if (!serviceWorkerSupported) {
    return "Seu navegador nao oferece suporte completo ao service worker. Vamos precisar disso na proxima etapa para assinatura push.";
  }

  if (permission === "granted") {
    return "Notificacoes ativadas com sucesso. A interface ja esta pronta para a proxima etapa de assinatura push com VAPID.";
  }

  if (permission === "denied") {
    return "As notificacoes foram bloqueadas neste navegador. Se quiser ativar depois, voce pode ajustar essa permissao nas configuracoes do site.";
  }

  return "Ative as notificacoes para preparar o aplicativo para lembretes futuros no desktop e no mobile.";
}

function getBadgeClasses(permission: PermissionState) {
  if (permission === "granted") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (permission === "denied") {
    return "bg-rose-100 text-rose-700";
  }

  if (permission === "default") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-slate-100 text-slate-700";
}

export function NotificationPermissionCard() {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [requesting, setRequesting] = useState(false);

  const notificationSupported = isNotificationSupported();
  const serviceWorkerSupported = isServiceWorkerSupported();

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  const message = useMemo(
    () => getPermissionMessage(permission, serviceWorkerSupported),
    [permission, serviceWorkerSupported],
  );

  async function handleRequestPermission() {
    setRequesting(true);

    try {
      const nextPermission = await requestNotificationPermission();
      setPermission(nextPermission);
    } finally {
      setRequesting(false);
    }
  }

  const canRequestPermission =
    notificationSupported && serviceWorkerSupported && permission !== "granted" && permission !== "denied";

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Notificacoes</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getBadgeClasses(permission)}`}
        >
          {getPermissionLabel(permission)}
        </span>
      </div>

      <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-400 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
          <span className="font-medium text-slate-900 dark:text-slate-100">Navegador:</span>{" "}
          {notificationSupported ? "suportado" : "nao suportado"}
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
          <span className="font-medium text-slate-900 dark:text-slate-100">Service worker:</span>{" "}
          {serviceWorkerSupported ? "disponivel" : "indisponivel"}
        </div>
      </div>

      {canRequestPermission ? (
        <Button disabled={requesting} onClick={handleRequestPermission} type="button">
          {requesting ? "Solicitando..." : "Ativar notificacoes"}
        </Button>
      ) : null}
    </Card>
  );
}
