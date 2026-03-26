import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { DomainError } from "@/server/services/task-domain/errors";

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

export class ApiRouteError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: JsonValue,
  ) {
    super(message);
    this.name = "ApiRouteError";
  }
}

export function ok(data: JsonValue, init?: ResponseInit): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    init,
  );
}

export function fail(status: number, code: string, message: string, details?: JsonValue): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details: details ?? null,
      },
    },
    { status },
  );
}

function resolveDomainStatus(error: DomainError): number {
  const message = error.message.toLowerCase();
  if (message.includes("not found")) return 404;
  return 400;
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiRouteError) {
    return fail(error.status, error.code, error.message, error.details);
  }

  if (error instanceof ZodError) {
    return fail(400, "VALIDATION_ERROR", "Invalid request input.", error.flatten());
  }

  if (error instanceof DomainError) {
    return fail(resolveDomainStatus(error), "DOMAIN_ERROR", error.message);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2022") {
      return fail(
        500,
        "DATABASE_SCHEMA_OUT_OF_SYNC",
        "Database schema is out of sync with Prisma schema. Apply pending migrations before retrying.",
        { prismaCode: error.code },
      );
    }
  }

  console.error(error);
  return fail(500, "INTERNAL_ERROR", "Unexpected internal server error.");
}

export async function readJsonOrThrow(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new DomainError("Request body must be a valid JSON.");
  }
}

export async function requireAuthenticatedUserId(providedUserId?: string | null): Promise<string> {
  const session = await auth();
  const sessionUserId = session?.user?.id;

  if (!sessionUserId) {
    throw new ApiRouteError(401, "UNAUTHORIZED", "Authentication required.");
  }

  if (providedUserId && providedUserId !== sessionUserId) {
    throw new ApiRouteError(403, "FORBIDDEN", "Authenticated user does not match request.");
  }

  return sessionUserId;
}
