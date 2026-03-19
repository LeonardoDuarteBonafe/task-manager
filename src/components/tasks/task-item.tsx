import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { recurrenceLabel } from "./format";
import type { TaskDto } from "./types";

type TaskItemProps = {
  task: TaskDto;
  onEndTask: (taskId: string) => Promise<void>;
  endingTaskId?: string | null;
};

export function TaskItem({ task, onEndTask, endingTaskId }: TaskItemProps) {
  const isEnding = endingTaskId === task.id;

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{task.title}</h3>
          {task.notes ? <p className="mt-1 text-sm text-slate-600">{task.notes}</p> : null}
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
          {task.status === "ACTIVE" ? "Ativa" : "Encerrada"}
        </span>
      </div>
      <div className="grid gap-1 text-sm text-slate-700">
        <p>Recorrencia: {recurrenceLabel(task)}</p>
        <p>Horario: {task.scheduledTime}</p>
        <p>Limite maximo: {task.maxOccurrences ?? "Infinito"}</p>
        <p>Fim: {task.endDate ? new Date(task.endDate).toLocaleDateString("pt-BR") : "Sem data final"}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/tasks/${task.id}/edit`}>
          <Button type="button" variant="secondary">
            Editar
          </Button>
        </Link>
        {task.status === "ACTIVE" ? (
          <Button disabled={isEnding} onClick={() => onEndTask(task.id)} type="button" variant="danger">
            Encerrar tarefa
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
