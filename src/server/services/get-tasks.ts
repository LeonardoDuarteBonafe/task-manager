import type { Task, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type GetTasksInput = {
  userId: string;
  status?: TaskStatus;
  page?: number;
  pageSize?: number;
};

type GetTasksResult = {
  items: Task[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function getTasks(input: GetTasksInput): Promise<GetTasksResult> {
  const page = Math.max(input.page ?? 1, 1);
  const pageSize = Math.max(input.pageSize ?? 10, 1);
  const skip = (page - 1) * pageSize;

  const where = {
    userId: input.userId,
    ...(input.status ? { status: input.status } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
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
