"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageState } from "@/components/ui/page-state";
import { Select } from "@/components/ui/select";
import { apiRequest } from "@/lib/http-client";
import { TaskItem } from "./task-item";
import type { TaskPageDto } from "./types";

const PAGE_SIZE = 10;

export function TasksPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, data: session } = useSession();
  const userId = session?.user?.id;
  const page = Math.max(Number(searchParams.get("page") ?? "1"), 1);
  const statusFilter = searchParams.get("status") ?? "";

  const [tasksData, setTasksData] = useState<TaskPageDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState(statusFilter);

  const loadTasks = useCallback(async () => {
    if (!userId) return;

    const query = new URLSearchParams({
      userId,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (statusFilter) query.set("status", statusFilter);

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
  }, [page, statusFilter, userId]);

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

  function applyFilter() {
    const query = new URLSearchParams({ page: "1" });
    if (draftStatus) query.set("status", draftStatus);
    router.push(`/tasks?${query.toString()}`);
  }

  async function handleTaskLifecycle(taskId: string, action: "end" | "cancel" | "abort") {
    if (!userId) return;
    setLoadingTaskId(taskId);
    setError(null);
    try {
      await apiRequest(`/api/tasks/${taskId}/${action}`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      await loadTasks();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao atualizar tarefa.");
    } finally {
      setLoadingTaskId(null);
    }
  }

  const items = tasksData?.items ?? [];
  const totalPages = tasksData?.totalPages ?? 1;

  if (status === "loading") {
    return (
      <AppShell subtitle="Aguarde..." title="Tarefas">
        <PageState description="Carregando sessao..." title="Carregando" />
      </AppShell>
    );
  }

  return (
    <AppShell subtitle="Tarefas maes com historico e estado atual." title="Tarefas">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="w-full max-w-xs">
            <label className="mb-1 block text-sm font-medium text-slate-700">Filtrar por status</label>
            <Select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)}>
              <option value="">Todos</option>
              <option value="ACTIVE">Ativas</option>
              <option value="ENDED">Finalizadas</option>
              <option value="CANCELED">Canceladas</option>
              <option value="ABORTED">Abortadas</option>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={applyFilter}>
              Aplicar filtro
            </Button>
            <Link href="/tasks">
              <Button type="button" variant="secondary">
                Limpar
              </Button>
            </Link>
            <Link href="/tasks/new">
              <Button type="button">Nova tarefa</Button>
            </Link>
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
              onAbortTask={(taskId) => handleTaskLifecycle(taskId, "abort")}
              onCancelTask={(taskId) => handleTaskLifecycle(taskId, "cancel")}
              onEndTask={(taskId) => handleTaskLifecycle(taskId, "end")}
              task={task}
            />
          ))
        : null}

      {!loading && !error && tasksData ? (
        <Card className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Pagina {tasksData.page} de {tasksData.totalPages} ({tasksData.total} tarefas)
          </p>
          <div className="flex gap-2">
            <Link href={`/tasks?${buildTasksPageQuery(searchParams, Math.max(1, page - 1))}`}>
              <Button disabled={page <= 1} variant="secondary">
                Anterior
              </Button>
            </Link>
            <Link href={`/tasks?${buildTasksPageQuery(searchParams, Math.min(totalPages, page + 1))}`}>
              <Button disabled={page >= totalPages} variant="secondary">
                Proxima
              </Button>
            </Link>
          </div>
        </Card>
      ) : null}
    </AppShell>
  );
}

function buildTasksPageQuery(searchParams: URLSearchParams, page: number) {
  const query = new URLSearchParams(searchParams.toString());
  query.set("page", String(page));
  return query.toString();
}
