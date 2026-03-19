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
import type { UpdateTaskInput } from "./task-domain/types";

export async function updateTask(input: UpdateTaskInput): Promise<Task> {
  const current = await prisma.task.findUnique({
    where: { id: input.taskId },
  });

  if (!current || current.userId !== input.userId) {
    throw new DomainError("Task not found.");
  }

  const title = input.title != null ? input.title.trim() : current.title;
  if (!title) {
    throw new DomainError("title is required.");
  }

  const recurrenceType = input.recurrenceType ?? current.recurrenceType;
  const scheduledTime = input.scheduledTime ?? current.scheduledTime;
  const timezone = input.timezone ?? current.timezone;
  const startDate = input.startDate ?? current.startDate;
  const endDate = input.endDate !== undefined ? input.endDate : current.endDate;
  const notificationRepeatMinutes = input.notificationRepeatMinutes ?? current.notificationRepeatMinutes;
  const maxOccurrences = input.maxOccurrences !== undefined ? input.maxOccurrences : current.maxOccurrences;
  const weekdays = normalizeRecurrenceWeekdays(recurrenceType, input.weekdays ?? current.weekdays);

  parseScheduledTimeToMinutes(scheduledTime);
  assertDateRange(startDate, endDate);
  assertNotificationRepeatMinutes(notificationRepeatMinutes);
  assertMaxOccurrences(maxOccurrences);

  const updated = await prisma.$transaction(async (tx) => {
    const task = await tx.task.update({
      where: { id: input.taskId },
      data: {
        title,
        notes: input.notes !== undefined ? input.notes?.trim() || null : current.notes,
        recurrenceType,
        scheduledTime,
        timezone,
        startDate,
        endDate,
        weekdays,
        notificationRepeatMinutes,
        maxOccurrences,
      },
    });

    await tx.taskOccurrence.deleteMany({
      where: {
        taskId: task.id,
        status: "PENDING",
        scheduledAt: { gte: new Date() },
      },
    });

    return task;
  });

  await generateOccurrences({
    taskId: updated.id,
    from: new Date(),
    horizonDays: input.generationHorizonDays,
  });

  return updated;
}
