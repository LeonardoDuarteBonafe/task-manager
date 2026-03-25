import { z } from "zod";
import { createTask, getTasks } from "@/server/services";
import { handleApiError, ok, readJsonOrThrow } from "../_shared/http";

const createTaskSchema = z.object({
  userId: z.string().min(1),
  clientId: z.string().min(1).optional(),
  title: z.string().min(1),
  notes: z.string().nullable().optional(),
  recurrenceType: z.enum(["ONCE", "DAILY", "WEEKLY", "MONTHLY"]),
  scheduledTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  timezone: z.string().min(1).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullable().optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  notificationRepeatMinutes: z.number().int().min(1).max(1440).optional(),
  maxOccurrences: z.number().int().min(1).nullable().optional(),
  generationHorizonDays: z.number().int().min(1).max(365).optional(),
});

const getTasksQuerySchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(1).optional(),
  taskCode: z.coerce.number().int().min(1).optional(),
  status: z.enum(["ACTIVE", "ENDED", "CANCELED", "ABORTED"]).optional(),
  favorite: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = getTasksQuerySchema.parse({
      userId: url.searchParams.get("userId"),
      name: url.searchParams.get("name") ?? undefined,
      taskCode: url.searchParams.get("taskCode") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      favorite: url.searchParams.get("favorite") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });

    const payload = await getTasks(query);
    return ok(payload);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonOrThrow(request);
    const input = createTaskSchema.parse(body);
    const task = await createTask(input);
    return ok(task, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
