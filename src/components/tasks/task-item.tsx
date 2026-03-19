import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime, recurrenceLabel, taskHistoryActionLabel, taskStatusLabel } from "./format";
import type { TaskDto } from "./types";

type TaskItemProps = {
  task: TaskDto;
  onEndTask: (taskId: string) => Promise<void>;
  onCancelTask: (taskId: string) => Promise<void>;
  onAbortTask: (taskId: string) => Promise<void>;
  loadingTaskId?: string | null;
};

export function TaskItem({ task, onEndTask, onCancelTask, onAbortTask, loadingTaskId }: TaskItemProps) {
  const isLoading = loadingTaskId === task.id;

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{task.title}</h3>
          {task.notes ? <p className="mt-1 text-sm text-slate-600">{task.notes}</p> : null}
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {taskStatusLabel(task.status)}
        </span>
      </div>

      <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
        <p>Recorrencia: {recurrenceLabel(task)}</p>
        <p>Horario: {task.scheduledTime}</p>
        <p>Criada em: {formatDateTime(task.createdAt)}</p>
        <p>Ultima edicao: {formatDateTime(task.updatedAt)}</p>
        <p>Finalizada em: {task.endedAt ? formatDateTime(task.endedAt) : "Nao finalizada"}</p>
        <p>Cancelada em: {task.canceledAt ? formatDateTime(task.canceledAt) : "Nao cancelada"}</p>
        <p>Abortada em: {task.abortedAt ? formatDateTime(task.abortedAt) : "Nao abortada"}</p>
        <p>Limite maximo: {task.maxOccurrences ?? "Infinito"}</p>
      </div>

      {task.history.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-800">Historico relevante</p>
          <div className="space-y-1">
            {task.history.slice(0, 5).map((historyItem) => (
              <p className="text-sm text-slate-600" key={historyItem.id}>
                {taskHistoryActionLabel(historyItem.action)} em {formatDateTime(historyItem.actedAt)}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link href={`/tasks/${task.id}/edit`}>
          <Button type="button" variant="secondary">
            Editar
          </Button>
        </Link>
        {task.status === "ACTIVE" ? (
          <>
            <Button disabled={isLoading} onClick={() => onEndTask(task.id)} type="button" variant="secondary">
              Finalizar
            </Button>
            <Button disabled={isLoading} onClick={() => onCancelTask(task.id)} type="button" variant="secondary">
              Cancelar
            </Button>
            <Button disabled={isLoading} onClick={() => onAbortTask(task.id)} type="button" variant="danger">
              Abortar
            </Button>
          </>
        ) : null}
      </div>
    </Card>
  );
}
