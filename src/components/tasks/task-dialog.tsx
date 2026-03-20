"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PageState } from "@/components/ui/page-state";
import { apiRequest } from "@/lib/http-client";
import { TaskForm, type TaskFormValues } from "./task-form";
import { buildTaskPayload } from "./task-payload";
import { formatDateTime, recurrenceLabel, taskHistoryActionLabel, taskStatusLabel } from "./format";
import type { TaskDto } from "./types";

type TaskDialogProps = {
  open: boolean;
  mode: "create" | "view" | "edit";
  taskId?: string | null;
  userId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
};

export function TaskDialog({ open, mode, taskId, userId, onClose, onChanged }: TaskDialogProps) {
  const [task, setTask] = useState<TaskDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !taskId || mode === "create") {
      setTask(null);
      setError(null);
      return;
    }

    void (async () => {
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
    })();
  }, [mode, open, taskId, userId]);

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

  async function handleSubmit(values: TaskFormValues) {
    setSubmitting(true);
    setError(null);

    try {
      if (mode === "create") {
        await apiRequest("/api/tasks", {
          method: "POST",
          body: JSON.stringify(buildTaskPayload(values, userId)),
        });
      } else if (taskId) {
        await apiRequest(`/api/tasks/${taskId}`, {
          method: "PUT",
          body: JSON.stringify(buildTaskPayload(values, userId)),
        });
      }

      await onChanged();
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel salvar a tarefa.");
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === "create" ? "Nova tarefa" : mode === "edit" ? "Editar tarefa" : "Detalhes da tarefa";
  const description =
    mode === "create"
      ? "Crie uma tarefa recorrente sem sair da listagem."
      : mode === "edit"
        ? "Atualize os campos da tarefa usando o mesmo modal."
        : "Consulte historico, status e dados completos da tarefa.";

  return (
    <Dialog description={description} onClose={onClose} open={open} size="lg" title={title}>
      {loading ? <PageState description="Carregando tarefa..." title="Carregando" /> : null}
      {!loading && error && !task && mode !== "create" ? <PageState description={error} title="Erro" /> : null}

      {!loading && (mode === "create" || task) && mode !== "view" ? (
        <TaskForm
          error={error}
          initialValues={initialValues}
          onSubmit={handleSubmit}
          submitLabel={mode === "create" ? "Criar tarefa" : "Salvar alteracoes"}
          submitting={submitting}
        />
      ) : null}

      {!loading && mode !== "create" && !task && error ? <PageState description={error} title="Erro" /> : null}

      {!loading && mode === "view" && task ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{task.title}</h3>
              {task.notes ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{task.notes}</p> : null}
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {taskStatusLabel(task.status)}
            </span>
          </div>

          <div className="grid gap-3 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2">
            <p>Recorrencia: {recurrenceLabel(task)}</p>
            <p>Horario: {task.scheduledTime}</p>
            <p>Data inicial: {formatDateTime(task.startDate)}</p>
            <p>Data final: {task.endDate ? formatDateTime(task.endDate) : "Sem data final"}</p>
            <p>Criada em: {formatDateTime(task.createdAt)}</p>
            <p>Ultima edicao: {formatDateTime(task.updatedAt)}</p>
            <p>Finalizada em: {task.endedAt ? formatDateTime(task.endedAt) : "Nao finalizada"}</p>
            <p>Cancelada em: {task.canceledAt ? formatDateTime(task.canceledAt) : "Nao cancelada"}</p>
            <p>Abortada em: {task.abortedAt ? formatDateTime(task.abortedAt) : "Nao abortada"}</p>
            <p>Favorita: {task.isFavorite ? "Sim" : "Nao"}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Historico relevante</p>
            {task.history.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-500">Nenhum evento relevante registrado.</p>
            ) : (
              <div className="space-y-2">
                {task.history.map((historyItem) => (
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300" key={historyItem.id}>
                    {taskHistoryActionLabel(historyItem.action)} em {formatDateTime(historyItem.actedAt)}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={onClose} type="button" variant="secondary">
              Fechar
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
