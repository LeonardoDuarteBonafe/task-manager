"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageState } from "@/components/ui/page-state";
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

  const [tasksData, setTasksData] = useState<TaskPageDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endingTaskId, setEndingTaskId] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<TaskPageDto>(
        `/api/tasks?userId=${encodeURIComponent(userId)}&page=${page}&pageSize=${PAGE_SIZE}`,
      );
      setTasksData(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao buscar tarefas.");
    } finally {
      setLoading(false);
    }
  }, [page, userId]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated") {
      void loadTasks();
    }
  }, [status, router, loadTasks]);

  const handleEndTask = async (taskId: string) => {
    if (!userId) return;
    setEndingTaskId(taskId);
    setError(null);
    try {
      await apiRequest(`/api/tasks/${taskId}/end`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      await loadTasks();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao encerrar tarefa.");
    } finally {
      setEndingTaskId(null);
    }
  };

  const items = tasksData?.items ?? [];
  const totalPages = tasksData?.totalPages ?? 1;

  if (status === "loading") {
    return (
      <AppShell subtitle="Aguarde..." title="Tasks">
        <PageState description="Carregando sessao..." title="Carregando" />
      </AppShell>
    );
  }

  return (
    <AppShell subtitle="Definicoes recorrentes de tarefas." title="Tasks">
      <div className="flex justify-end">
        <Link href="/tasks/new">
          <Button>Nova tarefa</Button>
        </Link>
      </div>

      {loading ? <PageState description="Buscando tarefas..." title="Carregando" /> : null}
      {!loading && error ? <PageState description={error} title="Erro" /> : null}
      {!loading && !error && items.length === 0 ? <PageState description="Crie sua primeira tarefa." title="Sem tarefas" /> : null}
      {!loading && !error && items.length > 0
        ? items.map((task) => <TaskItem endingTaskId={endingTaskId} key={task.id} onEndTask={handleEndTask} task={task} />)
        : null}

      {!loading && !error && tasksData ? (
        <Card className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Pagina {tasksData.page} de {tasksData.totalPages} ({tasksData.total} tarefas)
          </p>
          <div className="flex gap-2">
            <Link href={`/tasks?page=${Math.max(1, page - 1)}`}>
              <Button disabled={page <= 1} variant="secondary">
                Anterior
              </Button>
            </Link>
            <Link href={`/tasks?page=${Math.min(totalPages, page + 1)}`}>
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
