"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/http-client";
import type { PushSubscriptionStatus } from "@/lib/notifications/push-subscription-types";
import {
  ensureDevicePushSubscription,
  disableNotifications,
  enableNotifications,
  getNotificationPermission,
  getNotificationsEnabled,
  hasActiveCurrentDevicePushSubscription,
  isBackgroundPushAvailable,
  isIosDevice,
  isNotificationSupported,
  isPushManagerSupported,
  isStandaloneDisplayMode,
  removeDevicePushSubscription,
  isServiceWorkerSupported,
  showTaskNotificationPreview,
} from "@/lib/notifications/web-notifications";
import { loadSettingsFromCache, saveSettingsSnapshot } from "@/lib/offline/offline-store";
import { readOfflineAuthSession } from "@/lib/offline/user-session";

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
  const { data: session } = useSession();
  const [offlineUserId, setOfflineUserId] = useState<string | null>(null);
  const userId = session?.user?.id ?? offlineUserId;
  const [permission, setPermission] = useState<PermissionState>("default");
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<PushSubscriptionStatus | null>(null);

  const notificationSupported = isNotificationSupported();
  const serviceWorkerSupported = isServiceWorkerSupported();
  const backgroundPushAvailable = isBackgroundPushAvailable();
  const iosDevice = isIosDevice();
  const standaloneMode = isStandaloneDisplayMode();

  useEffect(() => {
    setPermission(getNotificationPermission());
    setEnabled(getNotificationsEnabled());
  }, []);

  useEffect(() => {
    setOfflineUserId(readOfflineAuthSession()?.user.id ?? null);
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }

    void loadSettingsFromCache(userId).then((cachedSettings) => {
      setEnabled(cachedSettings.notificationsEnabled);
      setPermission(cachedSettings.notificationPermission);
      setPushStatus({
        configured: cachedSettings.activeSubscriptionCount > 0,
        supported: isPushManagerSupported(),
        vapidPublicKeyConfigured: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
        activeSubscriptionCount: cachedSettings.activeSubscriptionCount,
        currentDeviceSubscribed: cachedSettings.currentDeviceSubscribed,
      });
    });
  }, [userId]);

  useEffect(() => {
    if (!userId || !backgroundPushAvailable) {
      return;
    }

    if (!navigator.onLine) {
      return;
    }

    void (async () => {
      const subscription = await hasActiveCurrentDevicePushSubscription(userId);
      const status = await apiRequest<PushSubscriptionStatus>(`/api/notifications/push-subscriptions?userId=${encodeURIComponent(userId)}`);
      const nextStatus = {
        ...status,
        currentDeviceSubscribed: subscription,
      };
      setPushStatus(nextStatus);
      await saveSettingsSnapshot(userId, {
        notificationsEnabled: getNotificationsEnabled(),
        notificationPermission: getNotificationPermission(),
        backgroundPushAvailable,
        currentDeviceSubscribed: subscription,
        activeSubscriptionCount: nextStatus.activeSubscriptionCount,
      });
    })().catch(() => {
      setPushStatus(null);
    });
  }, [backgroundPushAvailable, userId]);

  const message = useMemo(() => getPermissionMessage(permission, enabled), [enabled, permission]);

  const canToggle = notificationSupported && permission !== "unsupported";
  const buttonLabel = permission === "granted" && enabled ? "Desabilitar notificacoes" : "Habilitar notificacoes";

  async function handleToggleNotifications() {
    setLoading(true);
    setFeedback(null);

    try {
      if (permission === "granted" && enabled) {
        if (userId) {
          await removeDevicePushSubscription(userId).catch(() => false);
        }
        disableNotifications();
        setEnabled(false);
        const nextStatus =
          pushStatus
            ? {
                ...pushStatus,
                configured: Math.max(0, pushStatus.activeSubscriptionCount - (pushStatus.currentDeviceSubscribed ? 1 : 0)) > 0,
                currentDeviceSubscribed: false,
                activeSubscriptionCount: Math.max(0, pushStatus.activeSubscriptionCount - (pushStatus.currentDeviceSubscribed ? 1 : 0)),
              }
            : null;
        setPushStatus(nextStatus);
        if (userId) {
          await saveSettingsSnapshot(userId, {
            notificationsEnabled: false,
            notificationPermission: getNotificationPermission(),
            backgroundPushAvailable,
            currentDeviceSubscribed: false,
            activeSubscriptionCount: nextStatus?.activeSubscriptionCount ?? 0,
          });
        }
        setFeedback("Notificacoes do aplicativo desabilitadas neste dispositivo.");
        return;
      }

      const nextPermission = await enableNotifications();
      setPermission(nextPermission);
      const nextEnabled = getNotificationsEnabled();
      setEnabled(nextEnabled);

      if (nextPermission === "granted" && nextEnabled) {
        if (userId && backgroundPushAvailable) {
          if (navigator.onLine) {
            await ensureDevicePushSubscription(userId);
            const status = await apiRequest<PushSubscriptionStatus>(`/api/notifications/push-subscriptions?userId=${encodeURIComponent(userId)}`);
            const nextStatus = {
              ...status,
              currentDeviceSubscribed: true,
            };
            setPushStatus(nextStatus);
            await saveSettingsSnapshot(userId, {
              notificationsEnabled: true,
              notificationPermission: nextPermission,
              backgroundPushAvailable,
              currentDeviceSubscribed: true,
              activeSubscriptionCount: nextStatus.activeSubscriptionCount,
            });
            setFeedback("Notificacoes habilitadas com Web Push ativo neste dispositivo.");
          } else {
            await saveSettingsSnapshot(userId, {
              notificationsEnabled: true,
              notificationPermission: nextPermission,
              backgroundPushAvailable,
            });
            setFeedback("Notificacoes locais habilitadas. O registro push sera concluido quando a conexao voltar.");
          }
        } else {
          if (userId) {
            await saveSettingsSnapshot(userId, {
              notificationsEnabled: true,
              notificationPermission: nextPermission,
              backgroundPushAvailable,
            });
          }
          setFeedback("Notificacoes habilitadas com sucesso.");
        }
      } else if (nextPermission === "denied") {
        if (userId) {
          await saveSettingsSnapshot(userId, {
            notificationsEnabled: false,
            notificationPermission: nextPermission,
            backgroundPushAvailable,
          });
        }
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
      const shown = await showTaskNotificationPreview("Tomar remedio", "08:00", new Date(), undefined, 1, userId ?? undefined);
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
        <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
          <span className="font-medium text-slate-900 dark:text-slate-100">Push em segundo plano:</span>{" "}
          {backgroundPushAvailable ? (pushStatus?.currentDeviceSubscribed ? "ativo neste dispositivo" : "disponivel") : "indisponivel"}
        </div>
      </div>

      {mode === "settings" && backgroundPushAvailable ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {pushStatus?.currentDeviceSubscribed
            ? `Web Push ativo neste dispositivo. Dispositivos ativos: ${pushStatus.activeSubscriptionCount}.`
            : "Ative as notificacoes para registrar este dispositivo e permitir alertas com o app fechado."}
        </p>
      ) : null}

      {mode === "settings" && iosDevice ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {standaloneMode
            ? "iPhone detectado em modo app instalado. Este e o formato recomendado para receber notificacoes com o app fechado."
            : "iPhone detectado. Para notificacoes com o app fechado, abra este site no Safari e use Compartilhar > Adicionar a Tela de Inicio."}
        </div>
      ) : null}

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
