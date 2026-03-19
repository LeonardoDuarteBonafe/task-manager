export type OccurrenceDto = {
  id: string;
  taskId: string;
  userId: string;
  scheduledAt: string;
  status: "PENDING" | "COMPLETED" | "IGNORED";
  task: {
    id: string;
    title: string;
    notes: string | null;
    recurrenceType: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";
    scheduledTime: string;
    weekdays: number[];
    timezone: string;
  };
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
  status: "ACTIVE" | "ENDED";
  createdAt: string;
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
