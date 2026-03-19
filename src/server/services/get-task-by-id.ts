import { prisma } from "@/lib/prisma";
import { DomainError } from "./task-domain/errors";

type GetTaskByIdInput = {
  taskId: string;
  userId: string;
};

export async function getTaskById(input: GetTaskByIdInput) {
  const task = await prisma.task.findUnique({
    where: { id: input.taskId },
    include: {
      history: {
        orderBy: {
          actedAt: "desc",
        },
      },
    },
  });

  if (!task || task.userId !== input.userId) {
    throw new DomainError("Task not found.");
  }

  return task;
}
