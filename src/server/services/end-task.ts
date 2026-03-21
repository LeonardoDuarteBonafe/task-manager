import type { Task, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DomainError } from "./task-domain/errors";
import { recordTaskHistory } from "./task-history";

type ChangeTaskStatusInput = {
  taskId: string;
  userId: string;
  actedAt?: Date;
  reason?: string;
};

type ChangeTaskStatusResult = {
  task: Task;
  deletedFutureOccurrences: number;
};

async function transitionTaskStatus(
  input: ChangeTaskStatusInput,
  targetStatus: Extract<TaskStatus, "ENDED" | "CANCELED" | "ABORTED">,
): Promise<ChangeTaskStatusResult> {
  const actedAt = input.actedAt ?? new Date();

  return prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({
      where: { id: input.taskId },
    });

    if (!task || task.userId !== input.userId) {
      throw new DomainError("Task not found.");
    }

    if (task.status === targetStatus) {
      return { task, deletedFutureOccurrences: 0 };
    }

    const futurePendingOccurrences = await tx.taskOccurrence.findMany({
      where: {
        taskId: input.taskId,
        status: "PENDING",
        scheduledAt: {
          gt: actedAt,
        },
      },
      select: {
        id: true,
      },
    });

    if (futurePendingOccurrences.length > 0) {
      await tx.taskOccurrence.deleteMany({
        where: {
          id: {
            in: futurePendingOccurrences.map((item) => item.id),
          },
        },
      });
    }

    const updatedTask = await tx.task.update({
      where: { id: input.taskId },
      data: {
        status: targetStatus,
        endedAt: targetStatus === "ENDED" ? actedAt : task.endedAt,
        canceledAt: targetStatus === "CANCELED" ? actedAt : task.canceledAt,
        abortedAt: targetStatus === "ABORTED" ? actedAt : task.abortedAt,
      },
    });

    await recordTaskHistory(tx, {
      taskId: updatedTask.id,
      userId: input.userId,
      action: targetStatus,
      metadata: {
        deletedFutureOccurrences: futurePendingOccurrences.length,
        reason: input.reason?.trim() || null,
      },
      actedAt,
    });

    return {
      task: updatedTask,
      deletedFutureOccurrences: futurePendingOccurrences.length,
    };
  });
}

export async function endTask(input: ChangeTaskStatusInput) {
  return transitionTaskStatus(input, "ENDED");
}

export async function cancelTask(input: ChangeTaskStatusInput) {
  return transitionTaskStatus(input, "CANCELED");
}

export async function abortTask(input: ChangeTaskStatusInput) {
  return transitionTaskStatus(input, "ABORTED");
}
