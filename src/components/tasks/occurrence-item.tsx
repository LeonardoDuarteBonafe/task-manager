import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime, occurrenceStatusLabel, recurrenceLabel, taskStatusLabel, taskHistoryActionLabel } from "./format";
import type { OccurrenceDto } from "./types";

type OccurrenceItemProps = {
  occurrence: OccurrenceDto;
  onComplete?: (id: string) => Promise<void>;
  onIgnore?: (id: string) => Promise<void>;
  onCancelTask?: (taskId: string) => Promise<void>;
  onAbortTask?: (taskId: string) => Promise<void>;
  loadingActionId?: string | null;
};

export function OccurrenceItem({
  occurrence,
  onComplete,
  onIgnore,
  onCancelTask,
  onAbortTask,
  loadingActionId,
}: OccurrenceItemProps) {
  const isFuture = new Date(occurrence.scheduledAt).getTime() > Date.now();
  const isPending = occurrence.status === "PENDING";
  const latestHistory = occurrence.history[0];
  const isTaskActionLoading = loadingActionId === occurrence.task.id;
  const isOccurrenceActionLoading = loadingActionId === occurrence.id;

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900">{occurrence.task.title}</h3>
          <p className="text-sm text-slate-600">
            {formatDateTime(occurrence.scheduledAt)} | {occurrence.task.scheduledTime}
          </p>
          <p className="text-sm text-slate-500">
            Recorrencia: {recurrenceLabel(occurrence.task)} | Status: {occurrenceStatusLabel(occurrence.status, occurrence.scheduledAt)}
          </p>
          <p className="text-sm text-slate-500">Status da tarefa: {taskStatusLabel(occurrence.task.status)}</p>
          {occurrence.task.notes ? <p className="text-sm text-slate-500">{occurrence.task.notes}</p> : null}
          {latestHistory ? (
            <p className="text-xs text-slate-500">
              Ultima alteracao da recorrencia: {taskHistoryActionLabel(latestHistory.action)} em {formatDateTime(latestHistory.actedAt)}
            </p>
          ) : null}
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {occurrenceStatusLabel(occurrence.status, occurrence.scheduledAt)}
        </span>
      </div>

      {isPending ? (
        <div className="flex flex-wrap gap-2">
          {!isFuture ? (
            <>
              <Button disabled={isOccurrenceActionLoading} onClick={() => onComplete?.(occurrence.id)} type="button">
                Concluir
              </Button>
              <Button disabled={isOccurrenceActionLoading} onClick={() => onIgnore?.(occurrence.id)} type="button" variant="secondary">
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
    </Card>
  );
}
