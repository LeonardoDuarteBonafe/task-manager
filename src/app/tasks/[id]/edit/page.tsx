"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { TaskForm, type TaskFormValues } from "@/components/tasks/task-form";
import type { TaskDto } from "@/components/tasks/types";
import { AppShell } from "@/components/ui/app-shell";
import { Card } from "@/components/ui/card";
import { PageState } from "@/components/ui/page-state";
import { apiRequest } from "@/lib/http-client";

export default function EditTaskPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { status, data: session } = useSession();
  const userId = session?.user?.id;

  const taskId = params?.id ?? null;
  const [task, setTask] = useState<TaskDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTask = useCallback(async () => {
    if (!userId || !taskId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<TaskDto>(`/api/tasks/${taskId}?userId=${encodeURIComponent(userId)}`);
      setTask(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao carregar tarefa.");
    } finally {
      setLoading(false);
    }
  }, [taskId, userId]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated" && taskId) {
      void loadTask();
    }
  }, [status, router, taskId, loadTask]);

  const initialValues = useMemo(() => {
    if (!task) return undefined;
    return {
      title: task.title,
      notes: task.notes ?? "",
      scheduledTime: task.scheduledTime,
      recurrenceType: task.recurrenceType,
      weekdays: task.weekdays,
      startDate: new Date(task.startDate).toISOString().slice(0, 10),
      endDate: task.endDate ? new Date(task.endDate).toISOString().slice(0, 10) : "",
      notificationRepeatMinutes: task.notificationRepeatMinutes,
      maxOccurrences: task.maxOccurrences ? String(task.maxOccurrences) : "",
    } satisfies Partial<TaskFormValues>;
  }, [task]);

  const handleSubmit = async (values: TaskFormValues) => {
    if (!userId || !taskId) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/api/tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify({
          userId,
          title: values.title,
          notes: values.notes || null,
          scheduledTime: values.scheduledTime,
          recurrenceType: values.recurrenceType,
          weekdays: values.recurrenceType === "WEEKLY" ? values.weekdays : [],
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
          startDate: new Date(`${values.startDate}T00:00:00`).toISOString(),
          endDate: values.endDate ? new Date(values.endDate).toISOString() : null,
          notificationRepeatMinutes: values.notificationRepeatMinutes,
          maxOccurrences: values.maxOccurrences ? Number(values.maxOccurrences) : null,
        }),
      });
      router.push("/tasks");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao atualizar tarefa.");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <AppShell subtitle="Aguarde..." title="Editar task">
        <PageState description="Carregando tarefa..." title="Carregando" />
      </AppShell>
    );
  }

  if (!task) {
    return (
      <AppShell subtitle="Editar task" title="Editar task">
        <PageState description={error ?? "Tarefa nao encontrada."} title="Erro" />
      </AppShell>
    );
  }

  return (
    <AppShell subtitle="Atualize os dados da tarefa." title="Editar task">
      <Card>
        <TaskForm error={error} initialValues={initialValues} onSubmit={handleSubmit} submitLabel="Salvar alteracoes" submitting={submitting} />
      </Card>
    </AppShell>
  );
}
