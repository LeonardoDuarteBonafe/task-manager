import type { OccurrenceDetailsDto, TaskDto } from "./types";

const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

export function formatDateTime(dateIso: string): string {
  const date = new Date(dateIso);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function formatTime(dateIso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeStyle: "short",
  }).format(new Date(dateIso));
}

export function formatDate(dateIso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(dateIso));
}

export function recurrenceLabel(input: {
  recurrenceType: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";
  weekdays: number[];
}): string {
  if (input.recurrenceType === "ONCE") return "Uma vez";
  if (input.recurrenceType === "DAILY") return "Diariamente";
  if (input.recurrenceType === "MONTHLY") return "Mensalmente";
  return `Semanalmente (${input.weekdays.map((d) => weekdayLabels[d] ?? d).join(", ")})`;
}

export function taskStatusLabel(status: TaskDto["status"] | "ACTIVE" | "ENDED" | "CANCELED" | "ABORTED") {
  switch (status) {
    case "ACTIVE":
      return "Ativa";
    case "ENDED":
      return "Finalizada";
    case "CANCELED":
      return "Cancelada";
    case "ABORTED":
      return "Abortada";
    default:
      return status;
  }
}

export function taskStatusWithDateLabel(task: Pick<TaskDto, "status" | "isEnded" | "endedAt" | "canceledAt" | "abortedAt">) {
  const baseLabel = taskStatusLabel(task.status);

  if (!task.isEnded) {
    return baseLabel;
  }

  const endedAt = task.endedAt ?? task.canceledAt ?? task.abortedAt;
  return endedAt ? `${baseLabel} em ${formatDateTime(endedAt)}` : baseLabel;
}

export function occurrenceStatusLabel(status: "PENDING" | "COMPLETED" | "IGNORED", scheduledAt: string) {
  if (status === "COMPLETED") return "Concluida";
  if (status === "IGNORED") return "Ignorada";
  return new Date(scheduledAt).getTime() < Date.now() ? "Vencida" : "Proxima";
}

export function occurrenceStatusWithDateLabel(
  occurrence: Pick<OccurrenceDetailsDto, "status" | "scheduledAt" | "isEnded" | "completedAt" | "ignoredAt" | "treatedAt">,
) {
  const baseLabel = occurrenceStatusLabel(occurrence.status, occurrence.scheduledAt);

  if (!occurrence.isEnded) {
    return baseLabel;
  }

  const endedAt = occurrence.completedAt ?? occurrence.ignoredAt ?? occurrence.treatedAt;
  return endedAt ? `${baseLabel} em ${formatDateTime(endedAt)}` : baseLabel;
}

export function occurrenceActionLabel(action: string) {
  switch (action) {
    case "CREATED":
      return "Criada";
    case "COMPLETED":
      return "Concluida";
    case "IGNORED":
      return "Ignorada";
    case "NOTIFICATION_SENT":
      return "Notificacao enviada";
    case "STATUS_CHANGED":
      return "Status alterado";
    case "TASK_ENDED":
      return "Tarefa finalizada";
    default:
      return action;
  }
}

export function taskHistoryActionLabel(action: string) {
  switch (action) {
    case "CREATED":
      return "Criada";
    case "UPDATED":
      return "Editada";
    case "ENDED":
      return "Finalizada";
    case "CANCELED":
      return "Cancelada";
    case "ABORTED":
      return "Abortada";
    default:
      return action;
  }
}
