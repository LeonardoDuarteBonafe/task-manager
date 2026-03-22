import { prisma } from "@/lib/prisma";
import { DomainError } from "./task-domain/errors";
import { dispatchOccurrenceNotification } from "./occurrence-notifications";
import { listActivePushSubscriptionsWithKeys, markPushSubscriptionDelivery } from "./push-subscriptions";
import { sendWebPush } from "./web-push";

type SendDueOccurrencePushNotificationsInput = {
  referenceDate?: Date;
  candidateLimit?: number;
};

type SendDueOccurrencePushNotificationsResult = {
  processed: number;
  notified: number;
  subscriptionsNotified: number;
  skippedWithoutSubscriptions: number;
  errors: Array<{
    occurrenceId: string;
    message: string;
  }>;
};

const PUSH_JOB_LOCK_KEY = 22032026;

export async function sendDueOccurrencePushNotifications(
  input: SendDueOccurrencePushNotificationsInput = {},
): Promise<SendDueOccurrencePushNotificationsResult> {
  const lockRows = await prisma.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_lock(${PUSH_JOB_LOCK_KEY}) AS "locked"`;

  if (!lockRows[0]?.locked) {
    return {
      processed: 0,
      notified: 0,
      subscriptionsNotified: 0,
      skippedWithoutSubscriptions: 0,
      errors: [],
    };
  }

  try {
  const referenceDate = input.referenceDate ?? new Date();
  const candidateLimit = input.candidateLimit ?? 200;
  const dueOccurrences = await listAllDueOccurrenceNotificationCandidates(referenceDate, candidateLimit);

  let notified = 0;
  let subscriptionsNotified = 0;
  let skippedWithoutSubscriptions = 0;
  const errors: SendDueOccurrencePushNotificationsResult["errors"] = [];

  for (const candidate of dueOccurrences) {
    try {
      const subscriptions = await listActivePushSubscriptionsWithKeys({
        userId: candidate.userId,
      });

      if (subscriptions.length === 0) {
        skippedWithoutSubscriptions += 1;
        continue;
      }

      let deliveredToAnyDevice = false;

      for (const subscription of subscriptions) {
        try {
          await sendWebPush({
            subscription,
            payload: {
              title: candidate.task.title,
              body: `Horario: ${candidate.task.scheduledTime}`,
              url: `/recorrencias?occurrenceId=${encodeURIComponent(candidate.id)}`,
              occurrenceId: candidate.id,
              notificationId: `push-${candidate.id}-${referenceDate.getTime()}`,
              channel: "desktop",
            },
          });
          deliveredToAnyDevice = true;
          subscriptionsNotified += 1;
          await markPushSubscriptionDelivery({
            endpoint: subscription.endpoint,
            success: true,
            seenAt: referenceDate,
          });
        } catch (error) {
          const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) : null;
          const shouldDeactivate = statusCode === 404 || statusCode === 410;

          await markPushSubscriptionDelivery({
            endpoint: subscription.endpoint,
            success: false,
            keepActive: !shouldDeactivate,
            failureReason: error instanceof Error ? error.message : "WEB_PUSH_SEND_FAILED",
            seenAt: referenceDate,
          });
        }
      }

      if (!deliveredToAnyDevice) {
        continue;
      }

      await dispatchOccurrenceNotification({
        occurrenceId: candidate.id,
        userId: candidate.userId,
        notifiedAt: referenceDate,
      });
      notified += 1;
    } catch (error) {
      const message =
        error instanceof DomainError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unexpected push notification error.";

      errors.push({
        occurrenceId: candidate.id,
        message,
      });
    }
  }

    return {
      processed: dueOccurrences.length,
      notified,
      subscriptionsNotified,
      skippedWithoutSubscriptions,
      errors,
    };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${PUSH_JOB_LOCK_KEY})`;
  }
}

async function listAllDueOccurrenceNotificationCandidates(referenceDate: Date, candidateLimit: number) {
  const rows = await prisma.taskOccurrence.findMany({
    where: {
      isEnded: false,
      status: "PENDING",
      scheduledAt: {
        lte: referenceDate,
      },
      task: {
        isEnded: false,
        status: "ACTIVE",
      },
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
    orderBy: {
      scheduledAt: "asc",
    },
    take: Math.min(Math.max(candidateLimit, 1), 500),
  });

  return rows
    .filter((candidate) => {
      if (!candidate.lastNotificationAt) {
        return candidate.scheduledAt.getTime() <= referenceDate.getTime();
      }

      return candidate.lastNotificationAt.getTime() + candidate.task.notificationRepeatMinutes * 60_000 <= referenceDate.getTime();
    })
    .map((candidate) => ({
      id: candidate.id,
      userId: candidate.userId,
      recurrenceCode: candidate.recurrenceCode,
      scheduledAt: candidate.scheduledAt.toISOString(),
      isEnded: candidate.isEnded,
      status: candidate.status,
      lastNotificationAt: candidate.lastNotificationAt?.toISOString() ?? null,
      notificationAttempts: candidate.notificationAttempts,
      task: {
        id: candidate.task.id,
        title: candidate.task.title,
        scheduledTime: candidate.task.scheduledTime,
        notificationRepeatMinutes: candidate.task.notificationRepeatMinutes,
        isEnded: candidate.task.isEnded,
        status: candidate.task.status,
      },
    }));
}
