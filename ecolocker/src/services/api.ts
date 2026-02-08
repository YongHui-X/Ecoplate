const API_BASE = "/api/v1";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  skipAuthRedirect = false
): Promise<T> {
  const token = localStorage.getItem("ecolocker_token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401 && !skipAuthRedirect) {
      localStorage.removeItem("ecolocker_token");
      localStorage.removeItem("ecolocker_user");
      // Don't redirect here - let the auth context handle it
    }
    throw new ApiError(response.status, data.error || "Request failed");
  }

  return data as T;
}

// Special function for auth verification that doesn't trigger redirects
export async function verifyAuthToken(): Promise<{ id: number; email: string; name: string; avatarUrl?: string | null; userLocation?: string | null } | null> {
  try {
    return await request("/auth/me", {}, true);
  } catch {
    return null;
  }
}

export const api = {
  get<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint);
  },

  post<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: "DELETE" });
  },
};

export { ApiError };
