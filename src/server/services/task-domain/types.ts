import type { RecurrenceType } from "@prisma/client";

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
