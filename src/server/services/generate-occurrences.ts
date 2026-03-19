import type { Prisma, TaskOccurrence } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DomainError } from "./task-domain/errors";
import { buildOccurrenceSchedule, resolveUntilDate, startOfUtcDay } from "./task-domain/recurrence";
import type { GenerateOccurrencesInput } from "./task-domain/types";

const DEFAULT_HORIZON_DAYS = 30;

type GeneratedOccurrencesResult = {
  taskId: string;
  generatedCount: number;
  attemptedCount: number;
  from: Date;
  until: Date;
};

export async function generateOccurrences(input: GenerateOccurrencesInput): Promise<GeneratedOccurrencesResult> {
  const task = await prisma.task.findUnique({
    where: { id: input.taskId },
  });

  if (!task) {
    throw new DomainError("Task not found.");
  }

  if (task.status !== "ACTIVE") {
    return {
      taskId: task.id,
      generatedCount: 0,
      attemptedCount: 0,
      from: input.from ?? new Date(),
      until: input.until ?? new Date(),
    };
  }

  const from = input.from ?? new Date();
  const until = resolveUntilDate({
    from,
    until: input.until,
    endDate: task.endDate,
    horizonDays: input.horizonDays ?? DEFAULT_HORIZON_DAYS,
  });

  if (until.getTime() < from.getTime()) {
    return { taskId: task.id, generatedCount: 0, attemptedCount: 0, from, until };
  }

  const scheduledDates = buildOccurrenceSchedule(task, from, until);
  if (scheduledDates.length === 0) {
    return { taskId: task.id, generatedCount: 0, attemptedCount: 0, from, until };
  }

  let maxAllowedToCreate = scheduledDates.length;
  if (task.maxOccurrences != null) {
    const existingCount = await prisma.taskOccurrence.count({
      where: { taskId: task.id },
    });
    const remaining = task.maxOccurrences - existingCount;
    maxAllowedToCreate = Math.max(0, Math.min(scheduledDates.length, remaining));
  }

  if (maxAllowedToCreate === 0) {
    return { taskId: task.id, generatedCount: 0, attemptedCount: 0, from, until };
  }

  const rows: Prisma.TaskOccurrenceCreateManyInput[] = scheduledDates.slice(0, maxAllowedToCreate).map((scheduledAt) => ({
    taskId: task.id,
    userId: task.userId,
    scheduledAt,
    status: "PENDING",
  }));

  const result = await prisma.taskOccurrence.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return {
    taskId: task.id,
    generatedCount: result.count,
    attemptedCount: rows.length,
    from: startOfUtcDay(from),
    until: startOfUtcDay(until),
  };
}

export type { TaskOccurrence };
