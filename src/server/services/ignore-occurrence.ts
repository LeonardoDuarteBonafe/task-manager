import type { TaskOccurrence } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DomainError } from "./task-domain/errors";

type IgnoreOccurrenceInput = {
  occurrenceId: string;
  userId: string;
  ignoredAt?: Date;
};

export async function ignoreOccurrence(input: IgnoreOccurrenceInput): Promise<TaskOccurrence> {
  const ignoredAt = input.ignoredAt ?? new Date();

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

    if (occurrence.status === "IGNORED") {
      const alreadyIgnored = await tx.taskOccurrence.findUnique({
        where: { id: occurrence.id },
      });

      if (!alreadyIgnored) {
        throw new DomainError("Occurrence not found.");
      }

      return alreadyIgnored;
    }

    if (occurrence.status !== "PENDING") {
      throw new DomainError("Only pending occurrences can be ignored.");
    }

    const updated = await tx.taskOccurrence.update({
      where: { id: occurrence.id },
      data: {
        isEnded: true,
        status: "IGNORED",
        treatedAt: ignoredAt,
        ignoredAt,
      },
    });

    await tx.taskOccurrenceHistory.create({
      data: {
        occurrenceId: occurrence.id,
        userId: input.userId,
        action: "IGNORED",
        fromStatus: "PENDING",
        toStatus: "IGNORED",
        actedAt: ignoredAt,
      },
    });

    return updated;
  });
}
