"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { OccurrenceSection } from "@/components/tasks/occurrence-section";
import { NotificationPermissionCard } from "@/components/notifications/notification-permission-card";
import type { OccurrenceDto } from "@/components/tasks/types";
import { AppShell } from "@/components/ui/app-shell";
import { PageState } from "@/components/ui/page-state";
import { apiRequest } from "@/lib/http-client";

export default function DashboardPage() {
  const router = useRouter();
  const { status, data: session } = useSession();
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [overdue, setOverdue] = useState<OccurrenceDto[]>([]);
  const [upcoming, setUpcoming] = useState<OccurrenceDto[]>([]);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [overdueData, upcomingData] = await Promise.all([
        apiRequest<OccurrenceDto[]>(`/api/occurrences/overdue?userId=${encodeURIComponent(userId)}&limit=5`),
        apiRequest<OccurrenceDto[]>(`/api/occurrences/upcoming?userId=${encodeURIComponent(userId)}&limit=5`),
      ]);
      setOverdue(overdueData.sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt)));
      setUpcoming(upcomingData.sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt)));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao carregar dashboard.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated") {
      void loadData();
    }
  }, [status, router, loadData]);

  async function handleOccurrenceAction(occurrenceId: string, action: "complete" | "ignore") {
    if (!userId) return;
    setActionLoadingId(occurrenceId);
    setError(null);
    try {
      await apiRequest(`/api/occurrences/${occurrenceId}/${action === "complete" ? "complete" : "ignore"}`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Acao nao concluida.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleTaskLifecycle(taskId: string, action: "cancel" | "abort") {
    if (!userId) return;
    setActionLoadingId(taskId);
    setError(null);
    try {
      await apiRequest(`/api/tasks/${taskId}/${action}`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Acao nao concluida.");
    } finally {
      setActionLoadingId(null);
    }
  }

  const subtitle = useMemo(() => {
    if (!session?.user?.email) return "Gerencie recorrencias vencidas e proximas.";
    return `Usuario: ${session.user.email}`;
  }, [session?.user?.email]);

  if (status === "loading") {
    return (
      <AppShell subtitle="Aguarde..." title="Painel">
        <PageState description="Verificando sessao..." title="Carregando" />
      </AppShell>
    );
  }

  return (
    <AppShell subtitle={subtitle} title="Painel">
      <NotificationPermissionCard />
      <OccurrenceSection
        actionLoadingId={actionLoadingId}
        emptyMessage="Nenhuma recorrencia vencida no momento."
        error={error}
        loading={loading}
        occurrences={overdue}
        onAbortTask={(taskId) => handleTaskLifecycle(taskId, "abort")}
        onCancelTask={(taskId) => handleTaskLifecycle(taskId, "cancel")}
        onComplete={(id) => handleOccurrenceAction(id, "complete")}
        onIgnore={(id) => handleOccurrenceAction(id, "ignore")}
        title="Recorrencias vencidas"
        viewAllHref="/recorrencias?status=OVERDUE&page=1"
      />
      <OccurrenceSection
        actionLoadingId={actionLoadingId}
        emptyMessage="Nenhuma recorrencia proxima encontrada."
        error={error}
        loading={loading}
        occurrences={upcoming}
        onAbortTask={(taskId) => handleTaskLifecycle(taskId, "abort")}
        onCancelTask={(taskId) => handleTaskLifecycle(taskId, "cancel")}
        onComplete={(id) => handleOccurrenceAction(id, "complete")}
        onIgnore={(id) => handleOccurrenceAction(id, "ignore")}
        title="Proximas recorrencias"
        viewAllHref="/recorrencias?status=UPCOMING&page=1"
      />
    </AppShell>
  );
}
