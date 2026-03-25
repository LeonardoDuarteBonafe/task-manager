import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ListRecurrencesInput, RecurrenceFilterStatus } from "./task-domain/types";

type ListOccurrencesPaginatedResult = {
  items: Prisma.TaskOccurrenceGetPayload<{
    include: {
      task: {
        select: {
          id: true;
          clientId: true;
          taskCode: true;
          title: true;
          notes: true;
          recurrenceType: true;
          scheduledTime: true;
          weekdays: true;
          timezone: true;
          notificationRepeatMinutes: true;
          isFavorite: true;
          isEnded: true;
          status: true;
          updatedAt: true;
          endedAt: true;
          canceledAt: true;
          abortedAt: true;
        };
      };
      history: {
        orderBy: {
          actedAt: "desc";
        };
        take: 1;
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

function buildStatusWhere(status: RecurrenceFilterStatus | undefined, now: Date): Prisma.TaskOccurrenceWhereInput {
  switch (status) {
    case "OVERDUE":
      return { status: "PENDING", scheduledAt: { lt: now } };
    case "UPCOMING":
      return { status: "PENDING", scheduledAt: { gte: now } };
    case "OPEN":
      return { status: "PENDING" };
    case "COMPLETED":
      return { status: "COMPLETED" };
    case "IGNORED":
      return { status: "IGNORED" };
    case "CANCELED":
      return { task: { status: "CANCELED" } };
    case "ABORTED":
      return { task: { status: "ABORTED" } };
    case "FAVORITES":
      return { task: { isFavorite: true } };
    default:
      return {};
  }
}

function buildDateRange(dateFrom?: Date, dateTo?: Date): Prisma.DateTimeFilter | undefined {
  if (!dateFrom && !dateTo) return undefined;

  const filter: Prisma.DateTimeFilter = {};
  if (dateFrom) {
    filter.gte = dateFrom;
  }
  if (dateTo) {
    const inclusiveEnd = new Date(dateTo);
    inclusiveEnd.setHours(23, 59, 59, 999);
    filter.lte = inclusiveEnd;
  }
  return filter;
}

export async function listOccurrencesPaginated(input: ListRecurrencesInput): Promise<ListOccurrencesPaginatedResult> {
  const now = new Date();
  const page = Math.max(input.page ?? DEFAULT_PAGE, 1);
  const pageSize = Math.max(input.pageSize ?? DEFAULT_PAGE_SIZE, 1);
  const skip = (page - 1) * pageSize;
  const statusWhere = buildStatusWhere(input.status, now);
  const dateRange = buildDateRange(input.dateFrom, input.dateTo);
  const taskWhere: Prisma.TaskWhereInput = {
    ...(input.name ? { title: { contains: input.name, mode: "insensitive" } } : {}),
    ...(input.recurrenceType ? { recurrenceType: input.recurrenceType } : {}),
  };

  if (statusWhere.task) {
    Object.assign(taskWhere, statusWhere.task);
  }

  const occurrenceWhere = { ...statusWhere };
  delete occurrenceWhere.task;

  const where: Prisma.TaskOccurrenceWhereInput = {
    userId: input.userId,
    ...(input.recurrenceCode ? { recurrenceCode: input.recurrenceCode } : {}),
    ...occurrenceWhere,
    ...(dateRange
      ? {
          scheduledAt: {
            ...(occurrenceWhere.scheduledAt && typeof occurrenceWhere.scheduledAt === "object" ? occurrenceWhere.scheduledAt : {}),
            ...dateRange,
          },
        }
      : {}),
    ...(Object.keys(taskWhere).length > 0 ? { task: taskWhere } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.taskOccurrence.findMany({
      where,
      include: {
        task: {
          select: {
            id: true,
            clientId: true,
            taskCode: true,
            title: true,
            notes: true,
            recurrenceType: true,
            scheduledTime: true,
            weekdays: true,
            timezone: true,
            notificationRepeatMinutes: true,
            isFavorite: true,
            isEnded: true,
            status: true,
            updatedAt: true,
            endedAt: true,
            canceledAt: true,
            abortedAt: true,
          },
        },
        history: {
          orderBy: {
            actedAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        scheduledAt: input.sortOrder === "newest" ? "desc" : "asc",
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
