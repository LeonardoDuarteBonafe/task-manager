import { z } from "zod";
import { getOccurrenceById } from "@/server/services";
import { handleApiError, ok, requireAuthenticatedUserId } from "../../_shared/http";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const querySchema = z.object({
  userId: z.string().min(1).optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const params = paramsSchema.parse(await context.params);
    const url = new URL(request.url);
    const query = querySchema.parse({
      userId: url.searchParams.get("userId"),
    });
    const userId = await requireAuthenticatedUserId(query.userId);

    const occurrence = await getOccurrenceById({
      occurrenceId: params.id,
      userId,
    });

    return ok(occurrence);
  } catch (error) {
    return handleApiError(error);
  }
}
