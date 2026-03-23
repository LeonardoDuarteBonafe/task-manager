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
  const secrets = [process.env.CRON_SECRET, process.env.NOTIFICATIONS_JOB_SECRET].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  if (secrets.length === 0) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  return secrets.some((secret) => authorization === `Bearer ${secret}`);
}

async function runJob(request: Request) {
  if (!authorize(request)) {
    return fail(401, "UNAUTHORIZED", "Invalid job authorization.");
  }

  const rawBody =
    request.method === "POST" && request.headers.get("content-length") !== "0" ? await readJsonOrThrow(request).catch(() => undefined) : undefined;
  const body = bodySchema.parse(rawBody);
  const result = await sendDueOccurrencePushNotifications(body ?? {});
  return ok(result);
}

export async function POST(request: Request) {
  try {
    return await runJob(request);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: Request) {
  try {
    return await runJob(request);
  } catch (error) {
    return handleApiError(error);
  }
}
