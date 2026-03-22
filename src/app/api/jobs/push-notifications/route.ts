import { z } from "zod";
import { sendDueOccurrencePushNotifications } from "@/server/services";
import { fail, handleApiError, ok, readJsonOrThrow } from "../../_shared/http";

const bodySchema = z
  .object({
    referenceDate: z.coerce.date().optional(),
    candidateLimit: z.coerce.number().int().min(1).max(500).optional(),
  })
  .optional();

function authorize(request: Request) {
  const secret = process.env.NOTIFICATIONS_JOB_SECRET;

  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  try {
    if (!authorize(request)) {
      return fail(401, "UNAUTHORIZED", "Invalid job authorization.");
    }

    const rawBody = request.headers.get("content-length") === "0" ? undefined : await readJsonOrThrow(request).catch(() => undefined);
    const body = bodySchema.parse(rawBody);
    const result = await sendDueOccurrencePushNotifications(body ?? {});
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
