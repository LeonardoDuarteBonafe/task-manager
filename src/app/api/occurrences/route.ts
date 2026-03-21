import { z } from "zod";
import { listOccurrencesPaginated } from "@/server/services";
import { handleApiError, ok } from "../_shared/http";

const querySchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["OVERDUE", "UPCOMING", "OPEN", "COMPLETED", "IGNORED", "CANCELED", "ABORTED", "FAVORITES"]).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  recurrenceType: z.enum(["ONCE", "DAILY", "WEEKLY", "MONTHLY"]).optional(),
  sortOrder: z.enum(["oldest", "newest"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = querySchema.parse({
      userId: url.searchParams.get("userId"),
      status: url.searchParams.get("status") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      recurrenceType: url.searchParams.get("recurrenceType") ?? undefined,
      sortOrder: url.searchParams.get("sortOrder") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });

    const payload = await listOccurrencesPaginated(query);
    return ok(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
