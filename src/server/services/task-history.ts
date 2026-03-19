import type { Prisma } from "@prisma/client";

type DbClient = Prisma.TransactionClient;

type RecordTaskHistoryInput = {
  taskId: string;
  userId?: string | null;
  action: "CREATED" | "UPDATED" | "ENDED" | "CANCELED" | "ABORTED";
  metadata?: Prisma.InputJsonValue;
  actedAt?: Date;
};

export async function recordTaskHistory(db: DbClient, input: RecordTaskHistoryInput) {
  await db.taskHistory.create({
    data: {
      taskId: input.taskId,
      userId: input.userId ?? null,
      action: input.action,
      metadata: input.metadata,
      actedAt: input.actedAt ?? new Date(),
    },
  });
}
