export type TaskHistoryDto = {
  id: string;
  action: "CREATED" | "UPDATED" | "ENDED" | "CANCELED" | "ABORTED";
  actedAt: string;
  metadata?: Record<string, unknown> | null;
};

export type TaskDto = {
  id: string;
  userId: string;
  title: string;
  notes: string | null;
  recurrenceType: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";
  weekdays: number[];
  scheduledTime: string;
  timezone: string;
  startDate: string;
  endDate: string | null;
  notificationRepeatMinutes: number;
  maxOccurrences: number | null;
  status: "ACTIVE" | "ENDED" | "CANCELED" | "ABORTED";
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
  canceledAt: string | null;
  abortedAt: string | null;
  history: TaskHistoryDto[];
};

export type OccurrenceDto = {
  id: string;
  taskId: string;
  userId: string;
  scheduledAt: string;
  status: "PENDING" | "COMPLETED" | "IGNORED";
  history: Array<{
    id: string;
    action: string;
    actedAt: string;
  }>;
  task: {
    id: string;
    title: string;
    notes: string | null;
    recurrenceType: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";
    scheduledTime: string;
    weekdays: number[];
    timezone: string;
    status: "ACTIVE" | "ENDED" | "CANCELED" | "ABORTED";
    updatedAt: string;
    endedAt: string | null;
    canceledAt: string | null;
    abortedAt: string | null;
  };
};

export type TaskPageDto = {
  items: TaskDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type OccurrencePageDto = {
  items: OccurrenceDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
