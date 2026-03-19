const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

export function formatScheduled(dateIso: string): string {
  const date = new Date(dateIso);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(date);
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
