import { z } from "zod";
import { listOccurrenceNotificationCandidates } from "@/server/services";
import { handleApiError, ok } from "../../_shared/http";

const querySchema = z.object({
  userId: z.string().min(1),
  referenceDate: z.coerce.date().optional(),
  lookAheadMinutes: z.coerce.number().int().min(1).max(1440).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = querySchema.parse({
      userId: url.searchParams.get("userId"),
      referenceDate: url.searchParams.get("referenceDate") ?? undefined,
      lookAheadMinutes: url.searchParams.get("lookAheadMinutes") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    const items = await listOccurrenceNotificationCandidates(query);
    return ok(items);
  } catch (error) {
    return handleApiError(error);
  }
}
