import { prisma } from "@/lib/prisma";
import { DomainError } from "./task-domain/errors";
import { recordTaskHistory } from "./task-history";

type ToggleTaskFavoriteInput = {
  taskId: string;
  userId: string;
  isFavorite?: boolean;
};

export async function toggleTaskFavorite(input: ToggleTaskFavoriteInput) {
  const task = await prisma.task.findUnique({
    where: { id: input.taskId },
  });

  if (!task || task.userId !== input.userId) {
    throw new DomainError("Task not found.");
  }

  const nextValue = input.isFavorite ?? !task.isFavorite;

  return prisma.$transaction(async (tx) => {
    const updatedTask = await tx.task.update({
      where: { id: input.taskId },
      data: {
        isFavorite: nextValue,
      },
    });

    await recordTaskHistory(tx, {
      taskId: updatedTask.id,
      userId: input.userId,
      action: "UPDATED",
      metadata: {
        isFavorite: nextValue,
      },
    });

    return updatedTask;
  });
}
