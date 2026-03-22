import type { Prisma } from "@prisma/client";

export async function getNextTaskCode(db: Prisma.TransactionClient, userId: string) {
  const latestTask = await db.task.findFirst({
    where: { userId },
    orderBy: { taskCode: "desc" },
    select: { taskCode: true },
  });

  return (latestTask?.taskCode ?? 0) + 1;
}

export async function getNextRecurrenceCode(db: Prisma.TransactionClient, userId: string) {
  const latestOccurrence = await db.taskOccurrence.findFirst({
    where: { userId },
    orderBy: { recurrenceCode: "desc" },
    select: { recurrenceCode: true },
  });

  return (latestOccurrence?.recurrenceCode ?? 0) + 1;
}
