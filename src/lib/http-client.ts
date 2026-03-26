type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details: unknown;
  };
};

type ApiResponse<T> = ApiSuccess<T> | ApiError;

export const AUTH_INVALID_EVENT = "taskmanager-auth-invalid";

export async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_INVALID_EVENT));
  }

  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.success ? "Unexpected API error." : payload.error.message);
  }

  return payload.data;
}
