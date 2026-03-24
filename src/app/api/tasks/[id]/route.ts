import { z } from "zod";
import { getTaskById, updateTask } from "@/server/services";
import { handleApiError, ok, readJsonOrThrow } from "../../_shared/http";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const getQuerySchema = z.object({
  userId: z.string().min(1),
});

const updateTaskSchema = z.object({
  userId: z.string().min(1),
  clientId: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  recurrenceType: z.enum(["ONCE", "DAILY", "WEEKLY", "MONTHLY"]).optional(),
  scheduledTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional(),
  timezone: z.string().min(1).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullable().optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  notificationRepeatMinutes: z.number().int().min(1).max(1440).optional(),
  maxOccurrences: z.number().int().min(1).nullable().optional(),
  generationHorizonDays: z.number().int().min(1).max(365).optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const params = paramsSchema.parse(await context.params);
    const url = new URL(request.url);
    const query = getQuerySchema.parse({
      userId: url.searchParams.get("userId"),
    });

    const task = await getTaskById({
      taskId: params.id,
      userId: query.userId,
    });

    return ok(task);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const params = paramsSchema.parse(await context.params);
    const body = updateTaskSchema.parse(await readJsonOrThrow(request));

    const task = await updateTask({
      taskId: params.id,
      ...body,
    });
    return ok(task);
  } catch (error) {
    return handleApiError(error);
  }
}
