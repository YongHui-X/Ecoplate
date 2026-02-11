const getApiBase = (): string => {
  const isCapacitor = typeof window !== 'undefined' &&
    (window as any).Capacitor !== undefined;

  if (isCapacitor) {
    const url = import.meta.env.VITE_API_URL || 'https://18.143.173.20/api/v1';
    console.log('[API] Capacitor mode, using:', url);
    return url;
  }

  console.log('[API] Web mode, using: /api/v1');
  return '/api/v1';
};

const API_BASE = getApiBase();
console.log('[API] API_BASE:', API_BASE);

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("token");

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

  // Read response as text first, then parse as JSON
  // This prevents silent failures when server returns non-JSON (e.g., proxy error pages)
  const text = await response.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError(
      response.status,
      `Server error (${response.status}): ${text.substring(0, 100) || "Empty response"}`
    );
  }

  if (!response.ok) {
    // If unauthorized, clear token
    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    throw new ApiError(response.status, (data.error as string) || "Request failed");
  }

  return data as T;
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

  put<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: "DELETE" });
  },
};

export { ApiError, API_BASE };
