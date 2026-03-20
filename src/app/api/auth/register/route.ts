import { z } from "zod";
import { registerUser } from "@/server/services";
import { handleApiError, ok, readJsonOrThrow } from "../../_shared/http";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
  name: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJsonOrThrow(request));
    const user = await registerUser(body);

    return ok(
      {
        id: user.id,
        email: user.email,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
