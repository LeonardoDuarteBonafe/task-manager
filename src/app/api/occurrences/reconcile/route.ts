import { z } from "zod";
import { getOccurrenceByTaskAndScheduledAt } from "@/server/services";
import { handleApiError, ok } from "../../_shared/http";

const querySchema = z.object({
  userId: z.string().min(1),
  taskId: z.string().min(1),
  scheduledAt: z.coerce.date(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = querySchema.parse({
      userId: url.searchParams.get("userId"),
      taskId: url.searchParams.get("taskId"),
      scheduledAt: url.searchParams.get("scheduledAt"),
    });

    const occurrence = await getOccurrenceByTaskAndScheduledAt(query);
    return ok(occurrence);
  } catch (error) {
    return handleApiError(error);
  }
}
