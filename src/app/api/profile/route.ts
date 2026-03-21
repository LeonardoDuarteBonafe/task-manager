import { z } from "zod";
import { getProfile, updateProfile } from "@/server/services";
import { handleApiError, ok, readJsonOrThrow } from "../_shared/http";

const getProfileQuerySchema = z.object({
  userId: z.string().min(1),
});

const updateProfileSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = getProfileQuerySchema.parse({
      userId: url.searchParams.get("userId"),
    });

    const profile = await getProfile({ userId: query.userId });
    return ok(profile);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = updateProfileSchema.parse(await readJsonOrThrow(request));
    const profile = await updateProfile(body);
    return ok(profile);
  } catch (error) {
    return handleApiError(error);
  }
}
