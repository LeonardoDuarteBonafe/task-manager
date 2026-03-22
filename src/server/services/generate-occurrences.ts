import type { Prisma, TaskOccurrence } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DomainError } from "./task-domain/errors";
import { buildOccurrenceSchedule, resolveUntilDate, startOfUtcDay } from "./task-domain/recurrence";
import type { GenerateOccurrencesInput } from "./task-domain/types";
import { getNextRecurrenceCode } from "./code-sequence";

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

  const existingOccurrences = await prisma.taskOccurrence.findMany({
    where: {
      taskId: task.id,
      scheduledAt: {
        gte: from,
        lte: until,
      },
    },
    select: {
      scheduledAt: true,
    },
  });

  const existingKeys = new Set(existingOccurrences.map((occurrence) => occurrence.scheduledAt.toISOString()));
  const missingDates = scheduledDates.filter((scheduledAt) => !existingKeys.has(scheduledAt.toISOString()));

  let maxAllowedToCreate = missingDates.length;
  if (task.maxOccurrences != null) {
    const existingCount = await prisma.taskOccurrence.count({
      where: { taskId: task.id },
    });
    const remaining = task.maxOccurrences - existingCount;
    maxAllowedToCreate = Math.max(0, Math.min(missingDates.length, remaining));
  }

  if (maxAllowedToCreate === 0) {
    return { taskId: task.id, generatedCount: 0, attemptedCount: 0, from, until };
  }

  const datesToCreate = missingDates.slice(0, maxAllowedToCreate);

  const result = await prisma.$transaction(async (tx) => {
    let nextRecurrenceCode = await getNextRecurrenceCode(tx, task.userId);

    const rows: Prisma.TaskOccurrenceCreateManyInput[] = datesToCreate.map((scheduledAt) => {
      const row = {
        taskId: task.id,
        userId: task.userId,
        recurrenceCode: nextRecurrenceCode,
        scheduledAt,
        isEnded: false,
        status: "PENDING" as const,
      };

      nextRecurrenceCode += 1;
      return row;
    });

    const created = await tx.taskOccurrence.createMany({
      data: rows,
    });

    return {
      createdCount: created.count,
      attemptedCount: rows.length,
    };
  });

  return {
    taskId: task.id,
    generatedCount: result.createdCount,
    attemptedCount: result.attemptedCount,
    from: startOfUtcDay(from),
    until: startOfUtcDay(until),
  };
}

export type { TaskOccurrence };
