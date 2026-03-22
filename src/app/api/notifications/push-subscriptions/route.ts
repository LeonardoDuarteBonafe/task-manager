import { z } from "zod";
import { getPushSubscriptionStatus, removePushSubscription, upsertPushSubscription } from "@/server/services";
import { handleApiError, ok, readJsonOrThrow } from "../../_shared/http";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const statusQuerySchema = z.object({
  userId: z.string().min(1),
  endpoint: z.string().url().optional(),
});

const upsertBodySchema = z.object({
  userId: z.string().min(1),
  subscription: subscriptionSchema,
  userAgent: z.string().optional(),
  deviceLabel: z.string().optional(),
});

const deleteBodySchema = z.object({
  userId: z.string().min(1),
  endpoint: z.string().url(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = statusQuerySchema.parse({
      userId: url.searchParams.get("userId"),
      endpoint: url.searchParams.get("endpoint") ?? undefined,
    });

    const status = await getPushSubscriptionStatus(query);
    return ok(status);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = upsertBodySchema.parse(await readJsonOrThrow(request));
    const result = await upsertPushSubscription(body);
    return ok(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = deleteBodySchema.parse(await readJsonOrThrow(request));
    const result = await removePushSubscription(body);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
