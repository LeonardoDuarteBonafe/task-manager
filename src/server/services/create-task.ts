import type { Task } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateOccurrences } from "./generate-occurrences";
import { DomainError } from "./task-domain/errors";
import {
  assertDateRange,
  assertMaxOccurrences,
  assertNotificationRepeatMinutes,
  normalizeRecurrenceWeekdays,
  parseScheduledTimeToMinutes,
} from "./task-domain/recurrence";
import { recordTaskHistory } from "./task-history";
import type { CreateTaskInput } from "./task-domain/types";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DEFAULT_NOTIFICATION_REPEAT_MINUTES = 10;

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const title = input.title.trim();
  if (!title) {
    throw new DomainError("title is required.");
  }

  parseScheduledTimeToMinutes(input.scheduledTime);
  const startDate = input.startDate ?? new Date();
  const endDate = input.endDate ?? null;

  assertDateRange(startDate, endDate);

  const notificationRepeatMinutes =
    input.notificationRepeatMinutes ?? DEFAULT_NOTIFICATION_REPEAT_MINUTES;
  assertNotificationRepeatMinutes(notificationRepeatMinutes);
  assertMaxOccurrences(input.maxOccurrences);

  const weekdays = normalizeRecurrenceWeekdays(input.recurrenceType, input.weekdays);

  const task = await prisma.$transaction(async (tx) => {
    const createdTask = await tx.task.create({
      data: {
        userId: input.userId,
        title,
        notes: input.notes?.trim() || null,
        recurrenceType: input.recurrenceType,
        scheduledTime: input.scheduledTime,
        timezone: input.timezone ?? DEFAULT_TIMEZONE,
        startDate,
        endDate,
        weekdays,
        notificationRepeatMinutes,
        maxOccurrences: input.maxOccurrences ?? null,
        status: "ACTIVE",
      },
    });

    await recordTaskHistory(tx, {
      taskId: createdTask.id,
      userId: input.userId,
      action: "CREATED",
      metadata: {
        recurrenceType: input.recurrenceType,
      },
    });

    return createdTask;
  });

  await generateOccurrences({
    taskId: task.id,
    from: startDate,
    horizonDays: input.generationHorizonDays,
  });

  return task;
}
