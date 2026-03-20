import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime, recurrenceLabel, taskStatusLabel } from "./format";
import type { TaskDto } from "./types";

type FavoriteTaskCardProps = {
  task: TaskDto;
  loadingTaskId?: string | null;
  onToggleFavorite: (taskId: string, isFavorite: boolean) => Promise<void>;
  onOpen: (taskId: string) => void;
};

export function FavoriteTaskCard({ task, loadingTaskId, onToggleFavorite, onOpen }: FavoriteTaskCardProps) {
  const isLoading = loadingTaskId === task.id;

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <button className="text-left" onClick={() => onOpen(task.id)} type="button">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{task.title}</h3>
          </button>
          <p className="text-sm text-slate-600 dark:text-slate-400">{recurrenceLabel(task)}</p>
          <p className="text-sm text-slate-500 dark:text-slate-500">{task.scheduledTime}</p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
          {taskStatusLabel(task.status)}
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-500">Ultima atualizacao: {formatDateTime(task.updatedAt)}</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onOpen(task.id)} type="button" variant="secondary">
          Ver detalhes
        </Button>
        <Button disabled={isLoading} onClick={() => onToggleFavorite(task.id, false)} type="button" variant="ghost">
          Remover favorito
        </Button>
      </div>
    </Card>
  );
}
