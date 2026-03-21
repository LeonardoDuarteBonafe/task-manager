import type { RecurrenceType, TaskStatus } from "@prisma/client";

export type CreateTaskInput = {
  userId: string;
  title: string;
  notes?: string | null;
  recurrenceType: RecurrenceType;
  scheduledTime: string;
  timezone?: string;
  startDate?: Date;
  endDate?: Date | null;
  weekdays?: number[];
  notificationRepeatMinutes?: number;
  maxOccurrences?: number | null;
  generationHorizonDays?: number;
};

export type UpdateTaskInput = {
  taskId: string;
  userId: string;
  title?: string;
  notes?: string | null;
  recurrenceType?: RecurrenceType;
  scheduledTime?: string;
  timezone?: string;
  startDate?: Date;
  endDate?: Date | null;
  weekdays?: number[];
  notificationRepeatMinutes?: number;
  maxOccurrences?: number | null;
  generationHorizonDays?: number;
};

export type GenerateOccurrencesInput = {
  taskId: string;
  from?: Date;
  until?: Date;
  horizonDays?: number;
};

export type ListOccurrencesInput = {
  userId: string;
  referenceDate?: Date;
  limit?: number;
  page?: number;
  pageSize?: number;
};

export type RecurrenceFilterStatus =
  | "OVERDUE"
  | "UPCOMING"
  | "OPEN"
  | "COMPLETED"
  | "IGNORED"
  | "CANCELED"
  | "ABORTED"
  | "FAVORITES";

export type ListRecurrencesInput = {
  userId: string;
  status?: RecurrenceFilterStatus;
  dateFrom?: Date;
  dateTo?: Date;
  recurrenceType?: RecurrenceType;
  sortOrder?: "oldest" | "newest";
  page?: number;
  pageSize?: number;
};

export type ListTasksInput = {
  userId: string;
  status?: TaskStatus;
  favorite?: boolean;
  page?: number;
  pageSize?: number;
};
