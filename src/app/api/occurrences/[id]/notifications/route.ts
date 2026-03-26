import { z } from "zod";
import { dispatchOccurrenceNotification } from "@/server/services";
import { handleApiError, ok, readJsonOrThrow, requireAuthenticatedUserId } from "@/app/api/_shared/http";

const bodySchema = z.object({
  userId: z.string().min(1).optional(),
  notifiedAt: z.coerce.date().optional(),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = await context.params;
    const rawBody = await readJsonOrThrow(request);
    const body = bodySchema.parse(rawBody);
    const userId = await requireAuthenticatedUserId(body.userId);

    const result = await dispatchOccurrenceNotification({
      occurrenceId: params.id,
      userId,
      notifiedAt: body.notifiedAt,
    });

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
