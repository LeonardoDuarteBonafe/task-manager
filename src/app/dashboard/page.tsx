"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FavoriteTaskCard } from "@/components/tasks/favorite-task-card";
import { OccurrenceDialog } from "@/components/tasks/occurrence-dialog";
import { OccurrenceSection } from "@/components/tasks/occurrence-section";
import { TaskDialog } from "@/components/tasks/task-dialog";
import type { OccurrenceDetailsDto, OccurrenceDto, TaskDto } from "@/components/tasks/types";
import { AppShell } from "@/components/ui/app-shell";
import { Card } from "@/components/ui/card";
import { PageState } from "@/components/ui/page-state";
import { apiRequest } from "@/lib/http-client";
import { buildMockOccurrencePage, buildMockTaskPage, createMockDataset } from "@/lib/mocks/task-data";
import { isForcedUser } from "@/lib/mock-mode";

function updateOccurrenceFavorites(items: OccurrenceDto[], taskId: string, isFavorite: boolean) {
  return items.map((occurrence) =>
    occurrence.task.id === taskId
      ? {
          ...occurrence,
          task: {
            ...occurrence.task,
            isFavorite,
          },
        }
      : occurrence,
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { status, data: session } = useSession();
  const userId = session?.user?.id;
  const isMockMode = isForcedUser(session?.user);

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
  const [mockTasks, setMockTasks] = useState<TaskDto[]>([]);
  const [mockOccurrences, setMockOccurrences] = useState<OccurrenceDetailsDto[]>([]);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      if (isMockMode) {
        const dataset = createMockDataset();
        setMockTasks(dataset.tasks);
        setMockOccurrences(dataset.occurrences);
        setOverdue(buildMockOccurrencePage(dataset.occurrences, 1, { status: "OVERDUE", sortOrder: "oldest" }).items.slice(0, 3));
        setUpcoming(buildMockOccurrencePage(dataset.occurrences, 1, { status: "UPCOMING", sortOrder: "oldest" }).items.slice(0, 3));
        setFavorites(buildMockTaskPage(dataset.tasks.filter((task) => task.isFavorite), 1).items.slice(0, 3));
        return;
      }

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
  }, [isMockMode, userId]);

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
    if (isMockMode) {
      setMockOccurrences((current) => {
        const next = current.map((occurrence) =>
          occurrence.id === occurrenceId
            ? {
                ...occurrence,
                status: (action === "complete" ? "COMPLETED" : "IGNORED") as "COMPLETED" | "IGNORED",
                history: [
                  {
                    id: `mock-history-${Date.now()}`,
                    action: action === "complete" ? "COMPLETED" : "IGNORED",
                    actedAt: new Date().toISOString(),
                  },
                  ...occurrence.history,
                ],
              }
            : occurrence,
        );
        setOverdue(buildMockOccurrencePage(next, 1, { status: "OVERDUE", sortOrder: "oldest" }).items.slice(0, 3));
        setUpcoming(buildMockOccurrencePage(next, 1, { status: "UPCOMING", sortOrder: "oldest" }).items.slice(0, 3));
        return next;
      });
      return;
    }
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
    if (isMockMode) {
      setMockTasks((current) => {
        const nextTasks = current.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: (action === "cancel" ? "CANCELED" : "ABORTED") as "CANCELED" | "ABORTED",
                canceledAt: action === "cancel" ? new Date().toISOString() : task.canceledAt,
                abortedAt: action === "abort" ? new Date().toISOString() : task.abortedAt,
              }
            : task,
        );
        setFavorites(buildMockTaskPage(nextTasks.filter((task) => task.isFavorite), 1).items.slice(0, 3));
        return nextTasks;
      });
      setMockOccurrences((current) => {
        const now = Date.now();
        const nextOccurrences = current.filter((occurrence) =>
          occurrence.taskId !== taskId || new Date(occurrence.scheduledAt).getTime() < now,
        );
        setOverdue(buildMockOccurrencePage(nextOccurrences, 1, { status: "OVERDUE", sortOrder: "oldest" }).items.slice(0, 3));
        setUpcoming(buildMockOccurrencePage(nextOccurrences, 1, { status: "UPCOMING", sortOrder: "oldest" }).items.slice(0, 3));
        return nextOccurrences;
      });
      return;
    }
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
    if (isMockMode) {
      setMockTasks((current) => {
        const nextTasks = current.map((task) => (task.id === taskId ? { ...task, isFavorite } : task));
        setFavorites(buildMockTaskPage(nextTasks.filter((task) => task.isFavorite), 1).items.slice(0, 3));
        return nextTasks;
      });
      return;
    }
    setActionLoadingId(taskId);
    setError(null);
    const previousFavorites = favorites;
    const previousOverdue = overdue;
    const previousUpcoming = upcoming;
    setFavorites((current) => current.filter((task) => (isFavorite ? true : task.id !== taskId)));
    setOverdue((current) => updateOccurrenceFavorites(current, taskId, isFavorite));
    setUpcoming((current) => updateOccurrenceFavorites(current, taskId, isFavorite));
    try {
      await apiRequest(`/api/tasks/${taskId}/favorite`, {
        method: "POST",
        body: JSON.stringify({ userId, isFavorite }),
      });
    } catch (requestError) {
      setFavorites(previousFavorites);
      setOverdue(previousOverdue);
      setUpcoming(previousUpcoming);
      setError(requestError instanceof Error ? requestError.message : "Falha ao atualizar favorito.");
    } finally {
      setActionLoadingId(null);
    }
  }

  const subtitle = useMemo(
    () => "Priorize o que venceu, acompanhe o que vem a seguir e destaque seus favoritos.",
    [],
  );

  if (status === "loading") {
    return (
      <AppShell subtitle="Aguarde..." title="Painel">
        <PageState description="Verificando sessao..." title="Carregando" />
      </AppShell>
    );
  }

  return (
    <AppShell showPageHeader={false} subtitle={subtitle} title="Painel">
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
        initialTask={mockTasks.find((task) => task.id === taskModalState.taskId) ?? null}
        isMockMode={isMockMode}
      />
      <OccurrenceDialog
        occurrenceId={selectedOccurrenceId}
        onClose={() => setSelectedOccurrenceId(null)}
        open={Boolean(selectedOccurrenceId)}
        userId={userId ?? ""}
        initialOccurrence={(mockOccurrences.find((occurrence) => occurrence.id === selectedOccurrenceId) as never) ?? null}
        isMockMode={isMockMode}
      />
    </AppShell>
  );
}
