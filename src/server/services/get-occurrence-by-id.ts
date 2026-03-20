import { prisma } from "@/lib/prisma";
import { DomainError } from "./task-domain/errors";

type GetOccurrenceByIdInput = {
  occurrenceId: string;
  userId: string;
};

export async function getOccurrenceById(input: GetOccurrenceByIdInput) {
  const occurrence = await prisma.taskOccurrence.findUnique({
    where: { id: input.occurrenceId },
    include: {
      task: true,
      history: {
        orderBy: {
          actedAt: "desc",
        },
      },
    },
  });

  if (!occurrence || occurrence.userId !== input.userId) {
    throw new DomainError("Occurrence not found.");
  }

  return occurrence;
}
