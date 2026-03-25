"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageState } from "@/components/ui/page-state";
import { Select } from "@/components/ui/select";
import { buildMockTaskPage, createMockDataset } from "@/lib/mocks/task-data";
import { isForcedUser } from "@/lib/mock-mode";
import { endTaskOffline, loadTaskPageFromCache, syncTaskPageFromServer, synchronizeOfflineData, toggleTaskFavoriteOffline } from "@/lib/offline/offline-store";
import { readOfflineLastUser } from "@/lib/offline/user-session";
import { TaskDialog } from "./task-dialog";
import { type TaskFormValues } from "./task-form";
import { TaskItem } from "./task-item";
import type { TaskPageDto } from "./types";

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

function readFilters(searchParams: URLSearchParams) {
  return {
    page: Math.max(Number(searchParams.get("page") ?? "1"), 1),
    status: searchParams.get("status") ?? "",
    code: searchParams.get("code") ?? "",
    name: searchParams.get("name") ?? "",
  };
}

export function TasksPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, data: session } = useSession();
  const [offlineUserId, setOfflineUserId] = useState<string | null>(null);
  const userId = session?.user?.id ?? offlineUserId;
  const isMockMode = isForcedUser(session?.user);

  const [viewState, setViewState] = useState(() => readFilters(new URLSearchParams(searchParams.toString())));
  const { page, status: statusFilter, code: taskCodeFilter, name: nameFilter } = viewState;

  const [tasksData, setTasksData] = useState<TaskPageDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState(statusFilter);
  const [draftCode, setDraftCode] = useState(taskCodeFilter);
  const [draftName, setDraftName] = useState(nameFilter);
  const [mockTasks, setMockTasks] = useState<TaskPageDto["items"]>([]);
  const [modalState, setModalState] = useState<ModalState>({ open: false, mode: "create", taskId: null });

  const syncUrl = useCallback((nextPage: number, nextStatus: string, nextCode: string, nextName: string) => {
    const query = new URLSearchParams();
    query.set("page", String(nextPage));
    if (nextStatus) query.set("status", nextStatus);
    if (nextCode) query.set("code", nextCode);
    if (nextName) query.set("name", nextName);
    const nextUrl = query.toString() ? `/tasks?${query.toString()}` : "/tasks";
    window.history.pushState(null, "", nextUrl);
  }, []);

  const loadTasks = useCallback(async () => {
    if (!userId) return;

    if (isMockMode) {
      const dataset = createMockDataset();
      const pageData = buildMockTaskPage(dataset.tasks, page, {
        status: statusFilter,
        taskCode: taskCodeFilter ? Number(taskCodeFilter) : undefined,
        name: nameFilter,
      });
      setMockTasks(dataset.tasks);
      setTasksData(pageData);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const cachedData = await loadTaskPageFromCache(userId, page, {
        status: statusFilter,
        taskCode: taskCodeFilter ? Number(taskCodeFilter) : undefined,
        name: nameFilter,
      });
      setTasksData(cachedData);

      if (navigator.onLine) {
        const refreshed = await syncTaskPageFromServer(userId, page, {
          status: statusFilter,
          taskCode: taskCodeFilter ? Number(taskCodeFilter) : undefined,
          name: nameFilter,
        });
        if (refreshed.items.length === 0) {
          await synchronizeOfflineData(userId, "foreground-sync");
          const afterGlobalSync = await loadTaskPageFromCache(userId, page, {
            status: statusFilter,
            taskCode: taskCodeFilter ? Number(taskCodeFilter) : undefined,
            name: nameFilter,
          });
          setTasksData(afterGlobalSync);
        } else {
          setTasksData(refreshed);
        }
      }
    } catch (requestError) {
      const cachedData = await loadTaskPageFromCache(userId, page, {
        status: statusFilter,
        taskCode: taskCodeFilter ? Number(taskCodeFilter) : undefined,
        name: nameFilter,
      });
      setTasksData(cachedData);
      if (cachedData.items.length === 0) {
        setError(requestError instanceof Error ? requestError.message : "Falha ao buscar tarefas.");
      } else {
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  }, [isMockMode, nameFilter, page, statusFilter, taskCodeFilter, userId]);

  useEffect(() => {
    setDraftStatus(statusFilter);
    setDraftCode(taskCodeFilter);
    setDraftName(nameFilter);
  }, [nameFilter, statusFilter, taskCodeFilter]);

  useEffect(() => {
    setOfflineUserId(readOfflineLastUser()?.id ?? null);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setViewState(readFilters(new URLSearchParams(window.location.search)));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated" && navigator.onLine) {
      router.replace("/login");
      return;
    }

    if (!userId) return;

    void loadTasks();
  }, [status, router, loadTasks, userId]);

  useEffect(() => {
    const refresh = () => {
      void loadTasks();
    };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [loadTasks]);

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
    setViewState({ page: 1, status: draftStatus, code: draftCode, name: draftName });
    syncUrl(1, draftStatus, draftCode, draftName);
  }

  function goToPage(nextPage: number) {
    setViewState((current) => {
      const next = { ...current, page: nextPage };
      syncUrl(next.page, next.status, next.code, next.name);
      return next;
    });
  }

  async function handleTaskLifecycle(taskIdValue: string, action: "end", reason?: string) {
    if (!userId) return;
    if (isMockMode) {
      setMockTasks((current) => {
        const nextTasks = current.map((task) =>
          task.id === taskIdValue
            ? {
                ...task,
                isEnded: true,
                status: "ENDED" as const,
                endedAt: new Date().toISOString(),
              }
            : task,
        );
        setTasksData(buildMockTaskPage(nextTasks, page, { status: statusFilter, taskCode: taskCodeFilter ? Number(taskCodeFilter) : undefined, name: nameFilter }));
        return nextTasks;
      });
      return;
    }
    setLoadingTaskId(taskIdValue);
    setError(null);
    try {
      await endTaskOffline(taskIdValue, userId, reason);
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
        setTasksData(buildMockTaskPage(nextTasks, page, { status: statusFilter, taskCode: taskCodeFilter ? Number(taskCodeFilter) : undefined, name: nameFilter }));
        return nextTasks;
      });
      return;
    }
    setLoadingTaskId(taskIdValue);
    setError(null);
    const previousTasksData = tasksData;
    setTasksData((current) => applyFavoriteToTaskPage(current, taskIdValue, isFavorite, statusFilter));
    try {
      await toggleTaskFavoriteOffline(taskIdValue, userId, isFavorite);
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
          taskCode: current.length + 1,
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
          isEnded: false,
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
      setTasksData(buildMockTaskPage(nextTasks, 1, { status: statusFilter, taskCode: taskCodeFilter ? Number(taskCodeFilter) : undefined, name: nameFilter }));
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
      setTasksData(buildMockTaskPage(nextTasks, page, { status: statusFilter, taskCode: taskCodeFilter ? Number(taskCodeFilter) : undefined, name: nameFilter }));
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

  if (!userId) {
    return (
      <AppShell subtitle="Sem usuario local carregado." title="Tarefas">
        <PageState description="Abra esta tela online ao menos uma vez com sessao ativa para liberar o modo offline local." title="Sessao indisponivel" />
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
          <div className="w-full max-w-sm">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nome</label>
            <Input onChange={(event) => setDraftName(event.target.value)} placeholder="Filtrar por nome" value={draftName} />
          </div>
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
          <div className="w-full max-w-xs">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Codigo</label>
            <Input
              inputMode="numeric"
              onChange={(event) => setDraftCode(event.target.value.replace(/\D/g, ""))}
              placeholder="Ex.: 12"
              value={draftCode}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={applyFilter}>
              Aplicar filtro
            </Button>
            <Button
              onClick={() => {
                setDraftStatus("");
                setDraftCode("");
                setDraftName("");
                setViewState({ page: 1, status: "", code: "", name: "" });
                syncUrl(1, "", "", "");
              }}
              type="button"
              variant="secondary"
            >
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
              isHighlighted={taskCodeFilter ? task.taskCode === Number(taskCodeFilter) : Boolean(nameFilter && task.title.toLocaleLowerCase().includes(nameFilter.toLocaleLowerCase()))}
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
            <Button disabled={page <= 1} onClick={() => goToPage(Math.max(1, page - 1))} variant="secondary">
              Anterior
            </Button>
            <Button disabled={page >= totalPages} onClick={() => goToPage(Math.min(totalPages, page + 1))} variant="secondary">
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
        initialTask={items.find((task) => task.id === modalState.taskId) ?? mockTasks.find((task) => task.id === modalState.taskId) ?? null}
        isMockMode={isMockMode}
        onMockCreate={handleMockCreate}
        onMockUpdate={handleMockUpdate}
      />
    </AppShell>
  );
}
