import { z } from "zod";
import { cancelTask } from "@/server/services";
import { handleApiError, ok, readJsonOrThrow, requireAuthenticatedUserId } from "../../../_shared/http";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const bodySchema = z.object({
  userId: z.string().min(1).optional(),
  actedAt: z.coerce.date().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = paramsSchema.parse(await context.params);
    const body = bodySchema.parse(await readJsonOrThrow(request));
    const userId = await requireAuthenticatedUserId(body.userId);

    const result = await cancelTask({
      taskId: params.id,
      userId,
      actedAt: body.actedAt,
    });

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
