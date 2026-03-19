import { z } from "zod";
import { ignoreOccurrence } from "@/server/services";
import { handleApiError, ok, readJsonOrThrow } from "../../../_shared/http";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const bodySchema = z.object({
  userId: z.string().min(1),
  ignoredAt: z.coerce.date().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = paramsSchema.parse(await context.params);
    const body = bodySchema.parse(await readJsonOrThrow(request));

    const occurrence = await ignoreOccurrence({
      occurrenceId: params.id,
      userId: body.userId,
      ignoredAt: body.ignoredAt,
    });

    return ok(occurrence);
  } catch (error) {
    return handleApiError(error);
  }
}
