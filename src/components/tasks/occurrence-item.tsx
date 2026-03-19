import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatScheduled, recurrenceLabel } from "./format";
import type { OccurrenceDto } from "./types";

type OccurrenceItemProps = {
  occurrence: OccurrenceDto;
  onComplete: (id: string) => Promise<void>;
  onIgnore: (id: string) => Promise<void>;
  loadingActionId?: string | null;
};

export function OccurrenceItem({ occurrence, onComplete, onIgnore, loadingActionId }: OccurrenceItemProps) {
  const isLoading = loadingActionId === occurrence.id;

  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{occurrence.task.title}</h3>
        <p className="text-sm text-slate-600">
          {formatScheduled(occurrence.scheduledAt)} às {occurrence.task.scheduledTime}
        </p>
        <p className="text-xs text-slate-500">
          Recorrência: {recurrenceLabel(occurrence.task)}
        </p>
        {occurrence.task.notes ? <p className="mt-1 text-xs text-slate-500">{occurrence.task.notes}</p> : null}
      </div>
      <div className="flex gap-2">
        <Button disabled={isLoading} onClick={() => onComplete(occurrence.id)} type="button">
          Concluir
        </Button>
        <Button disabled={isLoading} onClick={() => onIgnore(occurrence.id)} type="button" variant="secondary">
          Ignorar
        </Button>
      </div>
    </Card>
  );
}
