import { prisma } from "@/lib/prisma";
import type { OccurrenceNotificationCandidate, OccurrenceNotificationDispatchResult } from "@/lib/notifications/occurrence-notification-types";
import { DomainError } from "./task-domain/errors";

type ListOccurrenceNotificationCandidatesInput = {
  userId: string;
  referenceDate?: Date;
  lookAheadMinutes?: number;
  limit?: number;
};

type DispatchOccurrenceNotificationInput = {
  occurrenceId: string;
  userId: string;
  notifiedAt?: Date;
};

const DEFAULT_LOOKAHEAD_MINUTES = 120;
const DEFAULT_LIMIT = 200;

function mapOccurrenceNotificationCandidate(
  occurrence: {
    id: string;
    userId: string;
    recurrenceCode: number;
    scheduledAt: Date;
    isEnded: boolean;
    status: "PENDING" | "COMPLETED" | "IGNORED";
    lastNotificationAt: Date | null;
    notificationAttempts: number;
    task: {
      id: string;
      title: string;
      scheduledTime: string;
      notificationRepeatMinutes: number;
      isEnded: boolean;
      status: "ACTIVE" | "ENDED" | "CANCELED" | "ABORTED";
    };
  },
): OccurrenceNotificationCandidate {
  return {
    id: occurrence.id,
    userId: occurrence.userId,
    recurrenceCode: occurrence.recurrenceCode,
    scheduledAt: occurrence.scheduledAt.toISOString(),
    isEnded: occurrence.isEnded,
    status: occurrence.status,
    lastNotificationAt: occurrence.lastNotificationAt?.toISOString() ?? null,
    notificationAttempts: occurrence.notificationAttempts,
    task: {
      id: occurrence.task.id,
      title: occurrence.task.title,
      scheduledTime: occurrence.task.scheduledTime,
      notificationRepeatMinutes: occurrence.task.notificationRepeatMinutes,
      isEnded: occurrence.task.isEnded,
      status: occurrence.task.status,
    },
  };
}

function isOccurrenceNotificationActive(occurrence: {
  isEnded: boolean;
  status: "PENDING" | "COMPLETED" | "IGNORED";
  task: {
    isEnded: boolean;
    status: "ACTIVE" | "ENDED" | "CANCELED" | "ABORTED";
  };
}) {
  return !occurrence.isEnded && occurrence.status === "PENDING" && !occurrence.task.isEnded && occurrence.task.status === "ACTIVE";
}

function getNextNotificationDate(occurrence: {
  scheduledAt: Date;
  lastNotificationAt: Date | null;
  task: {
    notificationRepeatMinutes: number;
  };
}) {
  if (!occurrence.lastNotificationAt) {
    return occurrence.scheduledAt;
  }

  return new Date(occurrence.lastNotificationAt.getTime() + occurrence.task.notificationRepeatMinutes * 60_000);
}

export async function listOccurrenceNotificationCandidates(
  input: ListOccurrenceNotificationCandidatesInput,
): Promise<OccurrenceNotificationCandidate[]> {
  const referenceDate = input.referenceDate ?? new Date();
  const lookAheadMinutes = input.lookAheadMinutes ?? DEFAULT_LOOKAHEAD_MINUTES;
  const limit = input.limit ?? DEFAULT_LIMIT;
  const lookAheadDate = new Date(referenceDate.getTime() + lookAheadMinutes * 60_000);

  const occurrences = await prisma.taskOccurrence.findMany({
    where: {
      userId: input.userId,
      isEnded: false,
      status: "PENDING",
      scheduledAt: {
        lte: lookAheadDate,
      },
      task: {
        isEnded: false,
        status: "ACTIVE",
      },
    },
    orderBy: {
      scheduledAt: "asc",
    },
    take: Math.min(Math.max(limit, 1), 500),
    select: {
      id: true,
      userId: true,
      recurrenceCode: true,
      scheduledAt: true,
      isEnded: true,
      status: true,
      lastNotificationAt: true,
      notificationAttempts: true,
      task: {
        select: {
          id: true,
          title: true,
          scheduledTime: true,
          notificationRepeatMinutes: true,
          isEnded: true,
          status: true,
        },
      },
    },
  });

  return occurrences.map(mapOccurrenceNotificationCandidate);
}

export async function dispatchOccurrenceNotification(
  input: DispatchOccurrenceNotificationInput,
): Promise<OccurrenceNotificationDispatchResult> {
  const notifiedAt = input.notifiedAt ?? new Date();

  return prisma.$transaction(async (tx) => {
    const occurrence = await tx.taskOccurrence.findUnique({
      where: {
        id: input.occurrenceId,
      },
      select: {
        id: true,
        userId: true,
        recurrenceCode: true,
        scheduledAt: true,
        isEnded: true,
        status: true,
        lastNotificationAt: true,
        notificationAttempts: true,
        task: {
          select: {
            id: true,
            title: true,
            scheduledTime: true,
            notificationRepeatMinutes: true,
            isEnded: true,
            status: true,
          },
        },
      },
    });

    if (!occurrence || occurrence.userId !== input.userId) {
      throw new DomainError("Occurrence not found.");
    }

    if (!isOccurrenceNotificationActive(occurrence)) {
      throw new DomainError("Occurrence notification is no longer active.");
    }

    const nextNotificationDate = getNextNotificationDate(occurrence);

    if (nextNotificationDate.getTime() > notifiedAt.getTime()) {
      throw new DomainError("Occurrence notification is not due yet.");
    }

    const nextAttempt = occurrence.notificationAttempts + 1;

    const updateResult = await tx.taskOccurrence.updateMany({
      where: {
        id: occurrence.id,
        userId: input.userId,
        isEnded: false,
        status: "PENDING",
        lastNotificationAt: occurrence.lastNotificationAt,
      },
      data: {
        lastNotificationAt: notifiedAt,
        notificationAttempts: {
          increment: 1,
        },
      },
    });

    if (updateResult.count === 0) {
      throw new DomainError("Occurrence notification was already dispatched by another process.");
    }

    const updated = await tx.taskOccurrence.findUnique({
      where: {
        id: occurrence.id,
      },
      select: {
        id: true,
        userId: true,
        recurrenceCode: true,
        scheduledAt: true,
        isEnded: true,
        status: true,
        lastNotificationAt: true,
        notificationAttempts: true,
        task: {
          select: {
            id: true,
            title: true,
            scheduledTime: true,
            notificationRepeatMinutes: true,
            isEnded: true,
            status: true,
          },
        },
      },
    });

    if (!updated) {
      throw new DomainError("Occurrence not found.");
    }

    await tx.taskOccurrenceHistory.create({
      data: {
        occurrenceId: occurrence.id,
        userId: input.userId,
        action: "NOTIFICATION_SENT",
        fromStatus: occurrence.status,
        toStatus: occurrence.status,
        actedAt: notifiedAt,
        metadata: {
          notificationAttempt: nextAttempt,
          scheduledAt: occurrence.scheduledAt.toISOString(),
        },
      },
    });

    return {
      occurrence: mapOccurrenceNotificationCandidate(updated),
      notifiedAt: notifiedAt.toISOString(),
    };
  });
}
