export type OccurrenceNotificationCandidate = {
  id: string;
  userId: string;
  recurrenceCode: number;
  scheduledAt: string;
  isEnded: boolean;
  status: "PENDING" | "COMPLETED" | "IGNORED";
  lastNotificationAt: string | null;
  notificationAttempts: number;
  task: {
    id: string;
    clientId?: string | null;
    title: string;
    scheduledTime: string;
    notificationRepeatMinutes: number;
    isEnded: boolean;
    status: "ACTIVE" | "ENDED" | "CANCELED" | "ABORTED";
  };
};

export type OccurrenceNotificationDispatchResult = {
  occurrence: OccurrenceNotificationCandidate;
  notifiedAt: string;
};
