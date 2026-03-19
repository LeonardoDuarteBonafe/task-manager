import { z } from "zod";
import { completeOccurrence } from "@/server/services";
import { handleApiError, ok, readJsonOrThrow } from "../../../_shared/http";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const bodySchema = z.object({
  userId: z.string().min(1),
  completedAt: z.coerce.date().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = paramsSchema.parse(await context.params);
    const body = bodySchema.parse(await readJsonOrThrow(request));

    const occurrence = await completeOccurrence({
      occurrenceId: params.id,
      userId: body.userId,
      completedAt: body.completedAt,
    });

    return ok(occurrence);
  } catch (error) {
    return handleApiError(error);
  }
}
