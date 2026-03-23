type OccurrenceNotificationContentInput = {
  taskTitle: string;
  scheduledTime: string;
  sentAt: Date;
  notificationAttempt: number;
};

export type OccurrenceNotificationContent = {
  title: string;
  body: string;
  isReminder: boolean;
};

function formatTime(date: Date) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildOccurrenceNotificationContent(input: OccurrenceNotificationContentInput): OccurrenceNotificationContent {
  const isReminder = input.notificationAttempt > 1;
  const title = isReminder ? `Lembrete: ${input.taskTitle}` : `Agora: ${input.taskTitle}`;
  const body = [
    isReminder ? "Esta recorrencia continua pendente." : "Sua recorrencia chegou ao horario previsto.",
    `Horario previsto: ${input.scheduledTime}`,
    `Enviado as ${formatTime(input.sentAt)}`,
  ].join("\n");

  return {
    title,
    body,
    isReminder,
  };
}
