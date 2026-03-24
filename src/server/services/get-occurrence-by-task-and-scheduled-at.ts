import { prisma } from "@/lib/prisma";
import { DomainError } from "./task-domain/errors";

type GetOccurrenceByTaskAndScheduledAtInput = {
  taskId: string;
  userId: string;
  scheduledAt: Date;
};

export async function getOccurrenceByTaskAndScheduledAt(input: GetOccurrenceByTaskAndScheduledAtInput) {
  const occurrence = await prisma.taskOccurrence.findFirst({
    where: {
      taskId: input.taskId,
      userId: input.userId,
      scheduledAt: input.scheduledAt,
    },
    include: {
      task: true,
      history: {
        orderBy: {
          actedAt: "desc",
        },
      },
    },
  });

  if (!occurrence) {
    throw new DomainError("Occurrence not found.");
  }

  return occurrence;
}
