import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { occurrenceStatusLabel, recurrenceLabel, formatDate, formatTime } from "./format";
import type { OccurrenceDto } from "./types";

type OccurrenceItemProps = {
  occurrence: OccurrenceDto;
  onComplete?: (id: string) => Promise<void>;
  onIgnore?: (id: string) => Promise<void>;
  onCancelTask?: (taskId: string) => Promise<void>;
  onAbortTask?: (taskId: string) => Promise<void>;
  onOpen?: (id: string) => void;
  loadingActionId?: string | null;
};

export function OccurrenceItem({ occurrence, onComplete, onIgnore, onCancelTask, onAbortTask, onOpen, loadingActionId }: OccurrenceItemProps) {
  const isFuture = new Date(occurrence.scheduledAt).getTime() > Date.now();
  const isPending = occurrence.status === "PENDING";
  const isTaskActionLoading = loadingActionId === occurrence.task.id;
  const isOccurrenceActionLoading = loadingActionId === occurrence.id;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-0 md:flex-row">
        <button
          className="min-w-0 flex-1 px-5 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/60"
          onClick={() => onOpen?.(occurrence.id)}
          type="button"
        >
          <h3 className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">{occurrence.task.title}</h3>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            {formatDate(occurrence.scheduledAt)} as {formatTime(occurrence.scheduledAt)}
          </p>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Recorrencia: {recurrenceLabel(occurrence.task)}</p>
        </button>

        <div className="flex w-full shrink-0 flex-col justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 md:w-[280px] md:border-l md:border-t-0 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex justify-start md:justify-end">
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {occurrenceStatusLabel(occurrence.status, occurrence.scheduledAt)}
            </span>
          </div>

          {isPending ? (
            <div className="flex flex-wrap gap-2 md:justify-end">
              {!isFuture ? (
                <>
                  <Button disabled={isOccurrenceActionLoading} onClick={() => onComplete?.(occurrence.id)} type="button" variant="success">
                    Concluir
                  </Button>
                  <Button disabled={isOccurrenceActionLoading} onClick={() => onIgnore?.(occurrence.id)} type="button" variant="softDanger">
                    Ignorar
                  </Button>
                </>
              ) : (
                <>
                  <Button disabled={isTaskActionLoading} onClick={() => onCancelTask?.(occurrence.task.id)} type="button" variant="secondary">
                    Cancelar tarefa
                  </Button>
                  <Button disabled={isTaskActionLoading} onClick={() => onAbortTask?.(occurrence.task.id)} type="button" variant="danger">
                    Abortar tarefa
                  </Button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
