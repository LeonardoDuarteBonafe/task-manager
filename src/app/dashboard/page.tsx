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
import { buildMockOccurrencePage, buildMockTaskPage, createMockDataset } from "@/lib/mocks/task-data";
import { isForcedUser } from "@/lib/mock-mode";
import {
  applyOccurrenceActionOffline,
  loadDashboardFromCache,
  synchronizeOfflineData,
  toggleTaskFavoriteOffline,
} from "@/lib/offline/offline-store";
import { readOfflineAuthSession } from "@/lib/offline/user-session";

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
  const [offlineUserId, setOfflineUserId] = useState<string | null>(null);
  const userId = session?.user?.id ?? offlineUserId;
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

      const cachedData = await loadDashboardFromCache(userId);
      setOverdue(cachedData.overdue);
      setUpcoming(cachedData.upcoming);
      setFavorites(cachedData.favorites);

      if (navigator.onLine) {
        await synchronizeOfflineData(userId, "foreground-sync");
        const refreshed = await loadDashboardFromCache(userId);
        setOverdue(refreshed.overdue);
        setUpcoming(refreshed.upcoming);
        setFavorites(refreshed.favorites);
      }
    } catch (requestError) {
      const cachedData = await loadDashboardFromCache(userId);
      setOverdue(cachedData.overdue);
      setUpcoming(cachedData.upcoming);
      setFavorites(cachedData.favorites);
      if (cachedData.overdue.length === 0 && cachedData.upcoming.length === 0 && cachedData.favorites.length === 0) {
        setError(requestError instanceof Error ? requestError.message : "Falha ao carregar dashboard.");
      }
    } finally {
      setLoading(false);
    }
  }, [isMockMode, userId]);

  useEffect(() => {
    setOfflineUserId(readOfflineAuthSession()?.user.id ?? null);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated" && navigator.onLine) {
      router.replace("/login");
      return;
    }
    if (userId) {
      void loadData();
    }
  }, [status, router, loadData, userId]);

  useEffect(() => {
    const refresh = () => {
      void loadData();
    };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [loadData]);

  async function handleOccurrenceAction(occurrenceId: string, action: "complete" | "ignore") {
    if (!userId) return;
    if (isMockMode) {
      setMockOccurrences((current) => {
        const next = current.map((occurrence) =>
          occurrence.id === occurrenceId
            ? {
                ...occurrence,
                isEnded: true,
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
      await applyOccurrenceActionOffline(occurrenceId, userId, action);
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
      await toggleTaskFavoriteOffline(taskId, userId, isFavorite);
      await loadData();
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

  if (!userId) {
    return (
      <AppShell subtitle="Sem usuario local carregado." title="Painel">
        <PageState description="Abra esta area online ao menos uma vez com sessao valida para reabrir o painel offline depois." title="Sessao indisponivel" />
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
            onComplete={(id) => handleOccurrenceAction(id, "complete")}
            onIgnore={(id) => handleOccurrenceAction(id, "ignore")}
            onOpen={setSelectedOccurrenceId}
            onViewTask={(taskCode) => router.push(`/tasks?code=${taskCode}&page=1`)}
            title="Proximas"
            viewAllHref="/recorrencias?status=UPCOMING&page=1"
          />
          <OccurrenceSection
            actionLoadingId={actionLoadingId}
            emptyMessage="Nenhuma recorrencia vencida no momento."
            error={error}
            loading={loading}
            occurrences={overdue}
            onComplete={(id) => handleOccurrenceAction(id, "complete")}
            onIgnore={(id) => handleOccurrenceAction(id, "ignore")}
            onOpen={setSelectedOccurrenceId}
            onViewTask={(taskCode) => router.push(`/tasks?code=${taskCode}&page=1`)}
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
        loadingActionId={actionLoadingId}
        onComplete={(id) => handleOccurrenceAction(id, "complete")}
        onIgnore={(id) => handleOccurrenceAction(id, "ignore")}
      />
    </AppShell>
  );
}
