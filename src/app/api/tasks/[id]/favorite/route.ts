import { z } from "zod";
import { toggleTaskFavorite } from "@/server/services";
import { handleApiError, ok, readJsonOrThrow } from "../../../_shared/http";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const bodySchema = z.object({
  userId: z.string().min(1),
  isFavorite: z.boolean().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = paramsSchema.parse(await context.params);
    const body = bodySchema.parse(await readJsonOrThrow(request));

    const task = await toggleTaskFavorite({
      taskId: params.id,
      ...body,
    });

    return ok(task);
  } catch (error) {
    return handleApiError(error);
  }
}
