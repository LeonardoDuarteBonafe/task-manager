"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FavoriteTaskCard } from "@/components/tasks/favorite-task-card";
import { NotificationPermissionCard } from "@/components/notifications/notification-permission-card";
import { OccurrenceDialog } from "@/components/tasks/occurrence-dialog";
import { OccurrenceSection } from "@/components/tasks/occurrence-section";
import { TaskDialog } from "@/components/tasks/task-dialog";
import type { OccurrenceDto, TaskDto } from "@/components/tasks/types";
import { AppShell } from "@/components/ui/app-shell";
import { Card } from "@/components/ui/card";
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
  const [favorites, setFavorites] = useState<TaskDto[]>([]);
  const [taskModalState, setTaskModalState] = useState<{ open: boolean; taskId: string | null; mode: "view" | "edit" }>({
    open: false,
    taskId: null,
    mode: "view",
  });
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [overdueData, upcomingData, favoriteData] = await Promise.all([
        apiRequest<OccurrenceDto[]>(`/api/occurrences/overdue?userId=${encodeURIComponent(userId)}&limit=3`),
        apiRequest<OccurrenceDto[]>(`/api/occurrences/upcoming?userId=${encodeURIComponent(userId)}&limit=3`),
        apiRequest<{ items: TaskDto[] }>(`/api/tasks?userId=${encodeURIComponent(userId)}&favorite=true&page=1&pageSize=3`),
      ]);

      setOverdue(overdueData.sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt)));
      setUpcoming(upcomingData.sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt)));
      setFavorites(favoriteData.items);
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

  async function handleToggleFavorite(taskId: string, isFavorite: boolean) {
    if (!userId) return;
    setActionLoadingId(taskId);
    setError(null);
    try {
      await apiRequest(`/api/tasks/${taskId}/favorite`, {
        method: "POST",
        body: JSON.stringify({ userId, isFavorite }),
      });
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao atualizar favorito.");
    } finally {
      setActionLoadingId(null);
    }
  }

  const subtitle = useMemo(() => {
    if (!session?.user?.email) return "Priorize o que venceu, acompanhe o que vem a seguir e destaque seus favoritos.";
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

      <div className="grid gap-6 xl:grid-cols-[1.4fr,1fr]">
        <div className="space-y-6">
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
            onOpen={setSelectedOccurrenceId}
            title="Proximas"
            viewAllHref="/recorrencias?status=UPCOMING&page=1"
          />
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
            onOpen={setSelectedOccurrenceId}
            title="Vencidas"
            viewAllHref="/recorrencias?status=OVERDUE&page=1"
          />
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Favoritos</h2>
            <button className="text-sm font-medium text-slate-700 underline dark:text-slate-300" onClick={() => router.push("/tasks")} type="button">
              Ver todas
            </button>
          </div>
          {loading ? <PageState description="Buscando favoritos..." title="Carregando" /> : null}
          {!loading && !error && favorites.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-600 dark:text-slate-400">Marque tarefas como favoritas para acompanhar aqui no painel.</p>
            </Card>
          ) : null}
          {!loading && !error && favorites.length > 0
            ? favorites.map((task) => (
                <FavoriteTaskCard
                  key={task.id}
                  loadingTaskId={actionLoadingId}
                  onOpen={(taskId) => setTaskModalState({ open: true, taskId, mode: "view" })}
                  onToggleFavorite={handleToggleFavorite}
                  task={task}
                />
              ))
            : null}
        </section>
      </div>

      <TaskDialog
        mode={taskModalState.mode}
        onChanged={loadData}
        onClose={() => setTaskModalState({ open: false, taskId: null, mode: "view" })}
        open={taskModalState.open}
        taskId={taskModalState.taskId}
        userId={userId ?? ""}
      />
      <OccurrenceDialog occurrenceId={selectedOccurrenceId} onClose={() => setSelectedOccurrenceId(null)} open={Boolean(selectedOccurrenceId)} userId={userId ?? ""} />
    </AppShell>
  );
}
