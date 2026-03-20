import type { TaskFormValues } from "./task-form";

export function buildTaskPayload(values: TaskFormValues, userId: string) {
  return {
    userId,
    title: values.title,
    notes: values.notes || null,
    startDate: new Date(`${values.startDate}T00:00:00`).toISOString(),
    scheduledTime: values.scheduledTime,
    recurrenceType: values.recurrenceType,
    weekdays: values.recurrenceType === "WEEKLY" ? values.weekdays : [],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
    endDate: values.endDate ? new Date(values.endDate).toISOString() : null,
    notificationRepeatMinutes: values.notificationRepeatMinutes,
    maxOccurrences: values.maxOccurrences ? Number(values.maxOccurrences) : null,
  };
}
