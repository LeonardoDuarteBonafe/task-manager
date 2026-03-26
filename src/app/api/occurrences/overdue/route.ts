import { z } from "zod";
import { getOverdueOccurrences } from "@/server/services";
import { handleApiError, ok, requireAuthenticatedUserId } from "../../_shared/http";

const querySchema = z.object({
  userId: z.string().min(1).optional(),
  referenceDate: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = querySchema.parse({
      userId: url.searchParams.get("userId"),
      referenceDate: url.searchParams.get("referenceDate") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });
    const userId = await requireAuthenticatedUserId(query.userId);

    const occurrences = await getOverdueOccurrences({ ...query, userId });
    return ok(occurrences);
  } catch (error) {
    return handleApiError(error);
  }
}
