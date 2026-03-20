import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime, recurrenceLabel, taskHistoryActionLabel, taskStatusLabel } from "./format";
import type { TaskDto } from "./types";

type TaskItemProps = {
  task: TaskDto;
  onEndTask: (taskId: string) => Promise<void>;
  onCancelTask: (taskId: string) => Promise<void>;
  onAbortTask: (taskId: string) => Promise<void>;
  onToggleFavorite: (taskId: string, isFavorite: boolean) => Promise<void>;
  onOpen: (taskId: string, mode?: "view" | "edit") => void;
  loadingTaskId?: string | null;
};

export function TaskItem({
  task,
  onEndTask,
  onCancelTask,
  onAbortTask,
  onToggleFavorite,
  onOpen,
  loadingTaskId,
}: TaskItemProps) {
  const isLoading = loadingTaskId === task.id;
  const latestHistory = task.history[0];

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <button className="min-w-0 text-left" onClick={() => onOpen(task.id, "view")} type="button">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{task.title}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{recurrenceLabel(task)}</p>
          <p className="text-sm text-slate-500 dark:text-slate-500">{task.scheduledTime}</p>
        </button>

        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
            {taskStatusLabel(task.status)}
          </span>
          <Button
            className="px-3 py-1 text-xs"
            disabled={isLoading}
            onClick={() => onToggleFavorite(task.id, !task.isFavorite)}
            type="button"
            variant={task.isFavorite ? "secondary" : "ghost"}
          >
            {task.isFavorite ? "Favorita" : "Favoritar"}
          </Button>
        </div>
      </div>

      <div className="grid gap-2 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2">
        <p>Criada em: {formatDateTime(task.createdAt)}</p>
        <p>Ultima edicao: {formatDateTime(task.updatedAt)}</p>
        <p>Limite maximo: {task.maxOccurrences ?? "Infinito"}</p>
        <p>Favorita: {task.isFavorite ? "Sim" : "Nao"}</p>
      </div>

      {latestHistory ? (
        <p className="text-sm text-slate-500 dark:text-slate-500">
          Ultima alteracao: {taskHistoryActionLabel(latestHistory.action)} em {formatDateTime(latestHistory.actedAt)}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onOpen(task.id, "edit")} type="button" variant="secondary">
          Editar
        </Button>
        <Button onClick={() => onOpen(task.id, "view")} type="button" variant="ghost">
          Ver detalhes
        </Button>
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
