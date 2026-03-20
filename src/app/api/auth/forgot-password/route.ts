import { z } from "zod";
import { requestPasswordReset } from "@/server/services";
import { handleApiError, ok, readJsonOrThrow } from "../../_shared/http";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJsonOrThrow(request));
    const result = await requestPasswordReset(body);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
