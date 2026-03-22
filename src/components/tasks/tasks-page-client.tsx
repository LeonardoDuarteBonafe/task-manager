"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageState } from "@/components/ui/page-state";
import { Select } from "@/components/ui/select";
import { apiRequest } from "@/lib/http-client";
import { buildMockTaskPage, createMockDataset } from "@/lib/mocks/task-data";
import { isForcedUser } from "@/lib/mock-mode";
import { TaskDialog } from "./task-dialog";
import { type TaskFormValues } from "./task-form";
import { TaskItem } from "./task-item";
import type { TaskPageDto } from "./types";

const PAGE_SIZE = 10;

type ModalState = {
  open: boolean;
  mode: "create" | "view" | "edit";
  taskId: string | null;
};

function applyFavoriteToTaskPage(data: TaskPageDto | null, taskId: string, isFavorite: boolean, statusFilter: string) {
  if (!data) return data;

  const items =
    statusFilter === "FAVORITES" && !isFavorite
      ? data.items.filter((task) => task.id !== taskId)
      : data.items.map((task) => (task.id === taskId ? { ...task, isFavorite } : task));

  const total = statusFilter === "FAVORITES" && !isFavorite ? Math.max(0, data.total - 1) : data.total;

  return {
    ...data,
    items,
    total,
    totalPages: Math.max(1, Math.ceil(total / data.pageSize)),
  };
}

export function TasksPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, data: session } = useSession();
  const userId = session?.user?.id;
  const isMockMode = isForcedUser(session?.user);

  const page = Math.max(Number(searchParams.get("page") ?? "1"), 1);
  const statusFilter = searchParams.get("status") ?? "";

  const [tasksData, setTasksData] = useState<TaskPageDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState(statusFilter);
  const [mockTasks, setMockTasks] = useState<TaskPageDto["items"]>([]);
  const [modalState, setModalState] = useState<ModalState>({ open: false, mode: "create", taskId: null });

  const loadTasks = useCallback(async () => {
    if (!userId) return;

    if (isMockMode) {
      const dataset = createMockDataset();
      const pageData = buildMockTaskPage(dataset.tasks, page, statusFilter);
      setMockTasks(dataset.tasks);
      setTasksData(pageData);
      setLoading(false);
      setError(null);
      return;
    }

    const query = new URLSearchParams({
      userId,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });

    if (statusFilter === "FAVORITES") query.set("favorite", "true");
    else if (statusFilter) query.set("status", statusFilter);

    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<TaskPageDto>(`/api/tasks?${query.toString()}`);
      setTasksData(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao buscar tarefas.");
    } finally {
      setLoading(false);
    }
  }, [isMockMode, page, statusFilter, userId]);

  useEffect(() => {
    setDraftStatus(statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    if (status !== "authenticated" || !userId) return;

    void loadTasks();
  }, [status, router, loadTasks, userId]);

  function openModal(nextMode: "create" | "view" | "edit", nextTaskId?: string | null) {
    setModalState({
      open: true,
      mode: nextMode,
      taskId: nextTaskId ?? null,
    });
  }

  function closeModal() {
    setModalState((current) => ({ ...current, open: false, taskId: null }));
  }

  function applyFilter() {
    const query = new URLSearchParams({ page: "1" });
    if (draftStatus) query.set("status", draftStatus);
    router.push(`/tasks?${query.toString()}`);
  }

  async function handleTaskLifecycle(taskIdValue: string, action: "end", reason?: string) {
    if (!userId) return;
    if (isMockMode) {
      setMockTasks((current) => {
        const nextTasks = current.map((task) =>
          task.id === taskIdValue
            ? {
                ...task,
                status: "ENDED" as const,
                endedAt: new Date().toISOString(),
              }
            : task,
        );
        setTasksData(buildMockTaskPage(nextTasks, page, statusFilter));
        return nextTasks;
      });
      return;
    }
    setLoadingTaskId(taskIdValue);
    setError(null);
    try {
      await apiRequest(`/api/tasks/${taskIdValue}/${action}`, {
        method: "POST",
        body: JSON.stringify({ userId, reason }),
      });
      await loadTasks();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao atualizar tarefa.");
      throw requestError;
    } finally {
      setLoadingTaskId(null);
    }
  }

  async function handleToggleFavorite(taskIdValue: string, isFavorite: boolean) {
    if (!userId) return;
    if (isMockMode) {
      setMockTasks((current) => {
        const nextTasks = current.map((task) => (task.id === taskIdValue ? { ...task, isFavorite } : task));
        setTasksData(buildMockTaskPage(nextTasks, page, statusFilter));
        return nextTasks;
      });
      return;
    }
    setLoadingTaskId(taskIdValue);
    setError(null);
    const previousTasksData = tasksData;
    setTasksData((current) => applyFavoriteToTaskPage(current, taskIdValue, isFavorite, statusFilter));
    try {
      await apiRequest(`/api/tasks/${taskIdValue}/favorite`, {
        method: "POST",
        body: JSON.stringify({ userId, isFavorite }),
      });
    } catch (requestError) {
      setTasksData(previousTasksData);
      setError(requestError instanceof Error ? requestError.message : "Falha ao atualizar favorito.");
    } finally {
      setLoadingTaskId(null);
    }
  }

  const items = tasksData?.items ?? [];
  const totalPages = tasksData?.totalPages ?? 1;

  async function handleMockCreate(values: TaskFormValues) {
    setMockTasks((current) => {
      const nextTasks = [
        {
          id: `mock-task-${Date.now()}`,
          userId: userId ?? "force-session-user",
          title: values.title,
          notes: values.notes || null,
          recurrenceType: values.recurrenceType,
          weekdays: values.weekdays,
          scheduledTime: values.scheduledTime,
          timezone: "America/Sao_Paulo",
          startDate: new Date(`${values.startDate}T00:00:00`).toISOString(),
          endDate: values.endDate ? new Date(values.endDate).toISOString() : null,
          notificationRepeatMinutes: values.notificationRepeatMinutes,
          maxOccurrences: values.maxOccurrences ? Number(values.maxOccurrences) : null,
          status: "ACTIVE" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          endedAt: null,
          canceledAt: null,
          abortedAt: null,
          history: [],
          isFavorite: false,
        },
        ...current,
      ];
      setTasksData(buildMockTaskPage(nextTasks, 1, statusFilter));
      return nextTasks;
    });
  }

  async function handleMockUpdate(taskIdValue: string, values: TaskFormValues) {
    setMockTasks((current) => {
      const nextTasks = current.map((task) =>
        task.id === taskIdValue
          ? {
              ...task,
              title: values.title,
              notes: values.notes || null,
              recurrenceType: values.recurrenceType,
              weekdays: values.weekdays,
              scheduledTime: values.scheduledTime,
              startDate: new Date(`${values.startDate}T00:00:00`).toISOString(),
              endDate: values.endDate ? new Date(values.endDate).toISOString() : null,
              notificationRepeatMinutes: values.notificationRepeatMinutes,
              maxOccurrences: values.maxOccurrences ? Number(values.maxOccurrences) : null,
              updatedAt: new Date().toISOString(),
            }
          : task,
      );
      setTasksData(buildMockTaskPage(nextTasks, page, statusFilter));
      return nextTasks;
    });
  }

  if (status === "loading") {
    return (
      <AppShell subtitle="Aguarde..." title="Tarefas">
        <PageState description="Carregando sessao..." title="Carregando" />
      </AppShell>
    );
  }

  return (
    <AppShell
      actions={
        <Button onClick={() => openModal("create")} type="button">
          Nova tarefa
        </Button>
      }
      subtitle="Visualize tarefas maes, abra detalhes em modal e edite sem sair da listagem."
      title="Tarefas"
    >
      <Card className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="w-full max-w-xs">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
            <Select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)}>
              <option value="">Todos</option>
              <option value="ACTIVE">Ativas</option>
              <option value="ENDED">Finalizadas</option>
              <option value="CANCELED">Canceladas</option>
              <option value="ABORTED">Abortadas</option>
              <option value="FAVORITES">Favoritas</option>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={applyFilter}>
              Aplicar filtro
            </Button>
            <Button onClick={() => router.push("/tasks")} type="button" variant="secondary">
              Limpar
            </Button>
          </div>
        </div>
      </Card>

      {loading ? <PageState description="Buscando tarefas..." title="Carregando" /> : null}
      {!loading && error ? <PageState description={error} title="Erro" /> : null}
      {!loading && !error && items.length === 0 ? <PageState description="Nenhuma tarefa encontrada." title="Sem tarefas" /> : null}
      {!loading && !error && items.length > 0
        ? items.map((task) => (
            <TaskItem
              key={task.id}
              loadingTaskId={loadingTaskId}
              onEndTask={(id, reason) => handleTaskLifecycle(id, "end", reason)}
              onOpen={(id, mode = "view") => openModal(mode, id)}
              onToggleFavorite={handleToggleFavorite}
              task={task}
            />
          ))
        : null}

      {!loading && !error && tasksData ? (
        <Card className="flex items-center justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Pagina {tasksData.page} de {tasksData.totalPages} ({tasksData.total} tarefas)
          </p>
          <div className="flex gap-2">
            <Button disabled={page <= 1} onClick={() => router.push(`/tasks?${buildTasksPageQuery(searchParams, Math.max(1, page - 1))}`)} variant="secondary">
              Anterior
            </Button>
            <Button
              disabled={page >= totalPages}
              onClick={() => router.push(`/tasks?${buildTasksPageQuery(searchParams, Math.min(totalPages, page + 1))}`)}
              variant="secondary"
            >
              Proxima
            </Button>
          </div>
        </Card>
      ) : null}

      <TaskDialog
        mode={modalState.mode}
        onChanged={loadTasks}
        onClose={closeModal}
        open={modalState.open}
        taskId={modalState.taskId}
        userId={userId ?? ""}
        initialTask={mockTasks.find((task) => task.id === modalState.taskId) ?? null}
        isMockMode={isMockMode}
        onMockCreate={handleMockCreate}
        onMockUpdate={handleMockUpdate}
      />
    </AppShell>
  );
}

function buildTasksPageQuery(searchParams: URLSearchParams, page: number) {
  const query = new URLSearchParams(searchParams.toString());
  query.set("page", String(page));
  return query.toString();
}
