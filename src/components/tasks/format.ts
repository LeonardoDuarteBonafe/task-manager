import type { TaskDto } from "./types";

const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

export function formatDateTime(dateIso: string): string {
  const date = new Date(dateIso);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
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

export function taskStatusLabel(status: TaskDto["status"] | "ACTIVE" | "ENDED" | "CANCELED" | "ABORTED"): string {
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

export function occurrenceStatusLabel(status: "PENDING" | "COMPLETED" | "IGNORED", scheduledAt: string): string {
  if (status === "COMPLETED") return "Concluida";
  if (status === "IGNORED") return "Ignorada";
  return new Date(scheduledAt).getTime() < Date.now() ? "Vencida" : "Proxima";
}

export function taskHistoryActionLabel(action: string): string {
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
