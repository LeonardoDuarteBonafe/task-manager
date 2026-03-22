import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ListTasksInput } from "./task-domain/types";

type GetTasksResult = {
  items: Prisma.TaskGetPayload<{
    include: {
      history: {
        orderBy: {
          actedAt: "desc";
        };
      };
    };
  }>[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function getTasks(input: ListTasksInput): Promise<GetTasksResult> {
  const page = Math.max(input.page ?? 1, 1);
  const pageSize = Math.max(input.pageSize ?? 10, 1);
  const skip = (page - 1) * pageSize;

  const where: Prisma.TaskWhereInput = {
    userId: input.userId,
    ...(input.taskCode ? { taskCode: input.taskCode } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.favorite !== undefined ? { isFavorite: input.favorite } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      include: {
        history: {
          orderBy: {
            actedAt: "desc",
          },
        },
      },
      orderBy: [{ isFavorite: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.task.count({ where }),
  ]);

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
