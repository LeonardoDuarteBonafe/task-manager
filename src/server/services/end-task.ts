import type { Task } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DomainError } from "./task-domain/errors";

type EndTaskInput = {
  taskId: string;
  userId: string;
  endedAt?: Date;
};

type EndTaskResult = {
  task: Task;
  ignoredFutureOccurrences: number;
};

export async function endTask(input: EndTaskInput): Promise<EndTaskResult> {
  const endedAt = input.endedAt ?? new Date();

  return prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({
      where: { id: input.taskId },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    });

    if (!task || task.userId !== input.userId) {
      throw new DomainError("Task not found.");
    }

    if (task.status === "ENDED") {
      const endedTask = await tx.task.findUnique({ where: { id: input.taskId } });
      if (!endedTask) {
        throw new DomainError("Task not found.");
      }
      return { task: endedTask, ignoredFutureOccurrences: 0 };
    }

    const updatedTask = await tx.task.update({
      where: { id: input.taskId },
      data: {
        status: "ENDED",
        endedAt,
      },
    });

    const futurePendingOccurrences = await tx.taskOccurrence.findMany({
      where: {
        taskId: input.taskId,
        status: "PENDING",
        scheduledAt: {
          gt: endedAt,
        },
      },
      select: {
        id: true,
      },
    });

    if (futurePendingOccurrences.length > 0) {
      await tx.taskOccurrence.updateMany({
        where: {
          id: {
            in: futurePendingOccurrences.map((item) => item.id),
          },
        },
        data: {
          status: "IGNORED",
          treatedAt: endedAt,
          ignoredAt: endedAt,
        },
      });

      await tx.taskOccurrenceHistory.createMany({
        data: futurePendingOccurrences.map((occurrence) => ({
          occurrenceId: occurrence.id,
          userId: input.userId,
          action: "TASK_ENDED",
          fromStatus: "PENDING",
          toStatus: "IGNORED",
          actedAt: endedAt,
        })),
      });
    }

    return {
      task: updatedTask,
      ignoredFutureOccurrences: futurePendingOccurrences.length,
    };
  });
}
