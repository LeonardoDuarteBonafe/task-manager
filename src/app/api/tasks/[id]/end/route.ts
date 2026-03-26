import { z } from "zod";
import { endTask } from "@/server/services";
import { handleApiError, ok, readJsonOrThrow, requireAuthenticatedUserId } from "../../../_shared/http";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const bodySchema = z.object({
  userId: z.string().min(1).optional(),
  endedAt: z.coerce.date().optional(),
  reason: z.string().trim().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = paramsSchema.parse(await context.params);
    const body = bodySchema.parse(await readJsonOrThrow(request));
    const userId = await requireAuthenticatedUserId(body.userId);

    const result = await endTask({
      taskId: params.id,
      userId,
      actedAt: body.endedAt,
      reason: body.reason,
    });

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
