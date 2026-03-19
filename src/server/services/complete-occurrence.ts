import type { TaskOccurrence } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DomainError } from "./task-domain/errors";

type CompleteOccurrenceInput = {
  occurrenceId: string;
  userId: string;
  completedAt?: Date;
};

export async function completeOccurrence(input: CompleteOccurrenceInput): Promise<TaskOccurrence> {
  const completedAt = input.completedAt ?? new Date();

  return prisma.$transaction(async (tx) => {
    const occurrence = await tx.taskOccurrence.findUnique({
      where: { id: input.occurrenceId },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    });

    if (!occurrence || occurrence.userId !== input.userId) {
      throw new DomainError("Occurrence not found.");
    }

    if (occurrence.status !== "PENDING") {
      throw new DomainError("Only pending occurrences can be completed.");
    }

    const fullOccurrence = await tx.taskOccurrence.findUnique({
      where: { id: occurrence.id },
      select: {
        scheduledAt: true,
      },
    });

    if (!fullOccurrence) {
      throw new DomainError("Occurrence not found.");
    }

    if (fullOccurrence.scheduledAt.getTime() > completedAt.getTime()) {
      throw new DomainError("Future occurrences cannot be completed.");
    }

    const updated = await tx.taskOccurrence.update({
      where: { id: occurrence.id },
      data: {
        status: "COMPLETED",
        treatedAt: completedAt,
        completedAt,
      },
    });

    await tx.taskOccurrenceHistory.create({
      data: {
        occurrenceId: occurrence.id,
        userId: input.userId,
        action: "COMPLETED",
        fromStatus: "PENDING",
        toStatus: "COMPLETED",
        actedAt: completedAt,
      },
    });

    return updated;
  });
}
