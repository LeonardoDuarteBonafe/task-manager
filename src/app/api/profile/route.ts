import { z } from "zod";
import { getProfile, updateProfile } from "@/server/services";
import { handleApiError, ok, readJsonOrThrow, requireAuthenticatedUserId } from "../_shared/http";

const getProfileQuerySchema = z.object({
  userId: z.string().min(1).optional(),
});

const updateProfileSchema = z.object({
  userId: z.string().min(1).optional(),
  name: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = getProfileQuerySchema.parse({
      userId: url.searchParams.get("userId"),
    });
    const userId = await requireAuthenticatedUserId(query.userId);

    const profile = await getProfile({ userId });
    return ok(profile);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = updateProfileSchema.parse(await readJsonOrThrow(request));
    const userId = await requireAuthenticatedUserId(body.userId);
    const profile = await updateProfile({ ...body, userId });
    return ok(profile);
  } catch (error) {
    return handleApiError(error);
  }
}
