import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  PushSubscriptionDeleteResult,
  PushSubscriptionInput,
  PushSubscriptionRecord,
  PushSubscriptionStatus,
  PushSubscriptionUpsertResult,
} from "@/lib/notifications/push-subscription-types";

type UpsertPushSubscriptionInput = {
  userId: string;
  subscription: PushSubscriptionInput;
  userAgent?: string | null;
  deviceLabel?: string | null;
};

type RemovePushSubscriptionInput = {
  userId: string;
  endpoint: string;
};

type ListActivePushSubscriptionsInput = {
  userId: string;
};

export type ActivePushSubscription = PushSubscriptionRecord & {
  keys: {
    p256dh: string;
    auth: string;
  };
};

type MarkPushSubscriptionDeliveryInput = {
  endpoint: string;
  success: boolean;
  keepActive?: boolean;
  failureReason?: string | null;
  seenAt?: Date;
};

type GetPushSubscriptionStatusInput = {
  userId: string;
  endpoint?: string | null;
};

type PushSubscriptionRow = {
  id: string;
  userId: string;
  endpoint: string;
  expirationTime: bigint | number | null;
  userAgent: string | null;
  deviceLabel: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  failureReason: string | null;
  p256dh?: string;
  auth?: string;
};

function mapPushSubscriptionRecord(row: PushSubscriptionRow): PushSubscriptionRecord {
  return {
    id: row.id,
    userId: row.userId,
    endpoint: row.endpoint,
    expirationTime: row.expirationTime === null ? null : Number(row.expirationTime),
    userAgent: row.userAgent,
    deviceLabel: row.deviceLabel,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
    lastFailureAt: row.lastFailureAt?.toISOString() ?? null,
    failureReason: row.failureReason,
  };
}

export async function upsertPushSubscription(input: UpsertPushSubscriptionInput): Promise<PushSubscriptionUpsertResult> {
  const now = new Date();
  const expirationTime =
    typeof input.subscription.expirationTime === "number" && Number.isFinite(input.subscription.expirationTime)
      ? BigInt(Math.trunc(input.subscription.expirationTime))
      : null;

  const rows = await prisma.$queryRaw<PushSubscriptionRow[]>(Prisma.sql`
    INSERT INTO "PushSubscription" (
      "id",
      "userId",
      "endpoint",
      "p256dh",
      "auth",
      "expirationTime",
      "userAgent",
      "deviceLabel",
      "isActive",
      "createdAt",
      "updatedAt",
      "lastSeenAt",
      "lastFailureAt",
      "failureReason"
    )
    VALUES (
      ${randomUUID()},
      ${input.userId},
      ${input.subscription.endpoint},
      ${input.subscription.keys.p256dh},
      ${input.subscription.keys.auth},
      ${expirationTime},
      ${input.userAgent ?? null},
      ${input.deviceLabel ?? null},
      true,
      ${now},
      ${now},
      ${now},
      NULL,
      NULL
    )
    ON CONFLICT ("endpoint")
    DO UPDATE SET
      "userId" = EXCLUDED."userId",
      "p256dh" = EXCLUDED."p256dh",
      "auth" = EXCLUDED."auth",
      "expirationTime" = EXCLUDED."expirationTime",
      "userAgent" = EXCLUDED."userAgent",
      "deviceLabel" = COALESCE(EXCLUDED."deviceLabel", "PushSubscription"."deviceLabel"),
      "isActive" = true,
      "updatedAt" = EXCLUDED."updatedAt",
      "lastSeenAt" = EXCLUDED."lastSeenAt",
      "failureReason" = NULL,
      "lastFailureAt" = NULL
    RETURNING
      "id",
      "userId",
      "endpoint",
      "expirationTime",
      "userAgent",
      "deviceLabel",
      "isActive",
      "createdAt",
      "updatedAt",
      "lastSeenAt",
      "lastSuccessAt",
      "lastFailureAt",
      "failureReason"
  `);

  return {
    subscription: mapPushSubscriptionRecord(rows[0]),
  };
}

export async function removePushSubscription(input: RemovePushSubscriptionInput): Promise<PushSubscriptionDeleteResult> {
  const removedCount = await prisma.$executeRaw(Prisma.sql`
    DELETE FROM "PushSubscription"
    WHERE "userId" = ${input.userId}
      AND "endpoint" = ${input.endpoint}
  `);

  return {
    removed: removedCount > 0,
  };
}

export async function listActivePushSubscriptions(input: ListActivePushSubscriptionsInput): Promise<PushSubscriptionRecord[]> {
  const rows = await prisma.$queryRaw<PushSubscriptionRow[]>(Prisma.sql`
    SELECT
      "id",
      "userId",
      "endpoint",
      "expirationTime",
      "userAgent",
      "deviceLabel",
      "isActive",
      "createdAt",
      "updatedAt",
      "lastSeenAt",
      "lastSuccessAt",
      "lastFailureAt",
      "failureReason"
    FROM "PushSubscription"
    WHERE "userId" = ${input.userId}
      AND "isActive" = true
    ORDER BY "updatedAt" DESC
  `);

  return rows.map(mapPushSubscriptionRecord);
}

export async function listActivePushSubscriptionsWithKeys(input: ListActivePushSubscriptionsInput): Promise<ActivePushSubscription[]> {
  const rows = await prisma.$queryRaw<PushSubscriptionRow[]>(Prisma.sql`
    SELECT
      "id",
      "userId",
      "endpoint",
      "p256dh",
      "auth",
      "expirationTime",
      "userAgent",
      "deviceLabel",
      "isActive",
      "createdAt",
      "updatedAt",
      "lastSeenAt",
      "lastSuccessAt",
      "lastFailureAt",
      "failureReason"
    FROM "PushSubscription"
    WHERE "userId" = ${input.userId}
      AND "isActive" = true
    ORDER BY "updatedAt" DESC
  `);

  return rows.map((row) => ({
    ...mapPushSubscriptionRecord(row),
    keys: {
      p256dh: row.p256dh ?? "",
      auth: row.auth ?? "",
    },
  }));
}

export async function markPushSubscriptionDelivery(input: MarkPushSubscriptionDeliveryInput): Promise<void> {
  const seenAt = input.seenAt ?? new Date();
  const nextIsActive = input.success || input.keepActive !== false;

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "PushSubscription"
    SET
      "isActive" = ${nextIsActive},
      "updatedAt" = ${seenAt},
      "lastSeenAt" = ${seenAt},
      "lastSuccessAt" = CASE WHEN ${input.success} THEN ${seenAt} ELSE "lastSuccessAt" END,
      "lastFailureAt" = ${input.success ? null : seenAt},
      "failureReason" = ${input.success ? null : input.failureReason ?? "PUSH_SEND_FAILED"}
    WHERE "endpoint" = ${input.endpoint}
  `);
}

export async function getPushSubscriptionStatus(input: GetPushSubscriptionStatusInput): Promise<PushSubscriptionStatus> {
  const rows = await prisma.$queryRaw<Array<{ activeCount: bigint | number; currentExists: bigint | number }>>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE "isActive" = true) AS "activeCount",
      COUNT(*) FILTER (WHERE "isActive" = true AND "endpoint" = ${input.endpoint ?? ""}) AS "currentExists"
    FROM "PushSubscription"
    WHERE "userId" = ${input.userId}
  `);

  const row = rows[0] ?? { activeCount: 0, currentExists: 0 };
  const activeSubscriptionCount = Number(row.activeCount);

  return {
    configured: activeSubscriptionCount > 0,
    supported: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT),
    vapidPublicKeyConfigured: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    currentDeviceSubscribed: Number(row.currentExists) > 0,
    activeSubscriptionCount,
  };
}
