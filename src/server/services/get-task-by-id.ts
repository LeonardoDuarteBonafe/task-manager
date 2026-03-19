import type { Task } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DomainError } from "./task-domain/errors";

type GetTaskByIdInput = {
  taskId: string;
  userId: string;
};

export async function getTaskById(input: GetTaskByIdInput): Promise<Task> {
  const task = await prisma.task.findUnique({
    where: { id: input.taskId },
  });

  if (!task || task.userId !== input.userId) {
    throw new DomainError("Task not found.");
  }

  return task;
}
