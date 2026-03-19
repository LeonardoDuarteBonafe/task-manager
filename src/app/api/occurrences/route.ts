import { z } from "zod";
import { listOccurrencesPaginated } from "@/server/services";
import { handleApiError, ok } from "../_shared/http";

const querySchema = z.object({
  userId: z.string().min(1),
  context: z.enum(["overdue", "upcoming"]),
  referenceDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = querySchema.parse({
      userId: url.searchParams.get("userId"),
      context: url.searchParams.get("context"),
      referenceDate: url.searchParams.get("referenceDate") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });

    const payload = await listOccurrencesPaginated(query);
    return ok(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
