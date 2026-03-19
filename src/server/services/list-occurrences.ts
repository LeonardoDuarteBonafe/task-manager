import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type OccurrenceContext = "overdue" | "upcoming";

type ListOccurrencesPaginatedInput = {
  userId: string;
  context: OccurrenceContext;
  referenceDate?: Date;
  page?: number;
  pageSize?: number;
};

type ListOccurrencesPaginatedResult = {
  items: Prisma.TaskOccurrenceGetPayload<{
    include: {
      task: {
        select: {
          id: true;
          title: true;
          notes: true;
          recurrenceType: true;
          scheduledTime: true;
          weekdays: true;
          timezone: true;
        };
      };
    };
  }>[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;

export async function listOccurrencesPaginated(
  input: ListOccurrencesPaginatedInput,
): Promise<ListOccurrencesPaginatedResult> {
  const referenceDate = input.referenceDate ?? new Date();
  const page = Math.max(input.page ?? DEFAULT_PAGE, 1);
  const pageSize = Math.max(input.pageSize ?? DEFAULT_PAGE_SIZE, 1);
  const skip = (page - 1) * pageSize;

  const where: Prisma.TaskOccurrenceWhereInput = {
    userId: input.userId,
    status: "PENDING",
    task: {
      status: "ACTIVE",
    },
    scheduledAt:
      input.context === "overdue"
        ? {
            lt: referenceDate,
          }
        : {
            gte: referenceDate,
          },
  };

  const [items, total] = await prisma.$transaction([
    prisma.taskOccurrence.findMany({
      where,
      include: {
        task: {
          select: {
            id: true,
            title: true,
            notes: true,
            recurrenceType: true,
            scheduledTime: true,
            weekdays: true,
            timezone: true,
          },
        },
      },
      orderBy: {
        scheduledAt: "asc",
      },
      skip,
      take: pageSize,
    }),
    prisma.taskOccurrence.count({ where }),
  ]);

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
