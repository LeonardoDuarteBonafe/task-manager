import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { occurrenceActionLabel, occurrenceStatusLabel, recurrenceLabel, taskStatusLabel, formatDate, formatTime } from "./format";
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
  const latestHistory = occurrence.history[0];
  const isTaskActionLoading = loadingActionId === occurrence.task.id;
  const isOccurrenceActionLoading = loadingActionId === occurrence.id;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-0 md:flex-row">
        <button
          className="flex-1 space-y-3 px-5 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/60"
          onClick={() => onOpen?.(occurrence.id)}
          type="button"
        >
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{occurrence.task.title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {formatDate(occurrence.scheduledAt)} as {formatTime(occurrence.scheduledAt)}
            </p>
          </div>

          <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-400 sm:grid-cols-2">
            <p>Recorrencia: {recurrenceLabel(occurrence.task)}</p>
            <p>Status da tarefa: {taskStatusLabel(occurrence.task.status)}</p>
            <p>Horario previsto: {occurrence.task.scheduledTime}</p>
            <p>Favorita na origem: {occurrence.task.isFavorite ? "Sim" : "Nao"}</p>
          </div>

          {latestHistory ? (
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Ultima alteracao: {occurrenceActionLabel(latestHistory.action)} em {formatDate(latestHistory.actedAt)}
            </p>
          ) : null}
        </button>

        <div className="flex w-full shrink-0 flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 md:w-[280px] md:border-l md:border-t-0 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {occurrenceStatusLabel(occurrence.status, occurrence.scheduledAt)}
            </span>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {recurrenceLabel(occurrence.task)}
            </span>
          </div>

          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <p>{isFuture ? "Ocorrencia futura" : "Ocorrencia ja iniciada ou vencida"}</p>
            <p>{occurrence.task.notes ? occurrence.task.notes : "Sem observacoes adicionais."}</p>
          </div>

          {isPending ? (
            <div className="mt-auto flex flex-wrap gap-2">
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
