import { toast } from "sonner";

const ID_TOKEN_KEY = "id_token";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: unknown;

  constructor(status: number, message: string, code?: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return true;
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export { isTokenExpired };

function getToken(): string | null {
  const token = localStorage.getItem(ID_TOKEN_KEY);
  if (!token) return null;
  
  if (isTokenExpired(token)) {
    clearToken();
    return null;
  }
  
  return token;
}

function clearToken(): void {
  localStorage.removeItem(ID_TOKEN_KEY);
}

function handle401(): void {
  clearToken();
  toast.error("Session expired. Please log in again.");
  window.location.href = "/login";
}

function parseErrorResponse(data: unknown): { message: string; code?: string } {
  if (typeof data === "object" && data !== null) {
    const error = (data as Record<string, unknown>).error;
    if (typeof error === "object" && error !== null) {
      const message = (error as Record<string, unknown>).message;
      const code = (error as Record<string, unknown>).code;
      return {
        message: typeof message === "string" ? message : "Request failed",
        code: typeof code === "string" || typeof code === "number" ? String(code) : undefined,
      };
    }
    const message = (data as Record<string, unknown>).message;
    if (typeof message === "string") {
      return { message };
    }
  }
  return { message: "Request failed" };
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {};
  
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((v, k) => (headers[k] = v));
    } else if (Array.isArray(options.headers)) {
      for (const [k, v] of options.headers) {
        headers[k] = v;
      }
    } else {
      Object.assign(headers, options.headers);
    }
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let body = options.body;
  if (body && typeof body === "object" && !(body instanceof FormData)) {
    body = JSON.stringify(body);
    if (!headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body,
  });

  if (response.status === 401) {
    handle401();
    throw new ApiError(401, "Unauthorized");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const { message, code } = parseErrorResponse(data);
    throw new ApiError(response.status, message, code, data);
  }

  return response.json();
}

export const api = {
  get: <T>(url: string): Promise<T> => {
    return request<T>(`${API_URL}${url}`, { method: "GET" });
  },

  post: <T>(url: string, body?: unknown): Promise<T> => {
    return request<T>(`${API_URL}${url}`, {
      method: "POST",
      body: body as BodyInit,
    });
  },

  put: <T>(url: string, body?: unknown): Promise<T> => {
    return request<T>(`${API_URL}${url}`, {
      method: "PUT",
      body: body as BodyInit,
    });
  },

  delete: <T>(url: string): Promise<T> => {
    return request<T>(`${API_URL}${url}`, { method: "DELETE" });
  },
};

interface TrpcResponse<T> {
  result: {
    data: T;
  };
}

export const trpc = {
  query: async <T>(
    procedure: string,
    input?: Record<string, unknown>
  ): Promise<T> => {
    const url = input
      ? `${API_URL}/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify(input))}`
      : `${API_URL}/trpc/${procedure}`;

    const response = await request<TrpcResponse<T>>(url, { method: "GET" });
    return response.result.data;
  },

  mutation: async <T>(
    procedure: string,
    input?: Record<string, unknown>
  ): Promise<T> => {
    const response = await request<TrpcResponse<T>>(
      `${API_URL}/trpc/${procedure}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input) as unknown as BodyInit,
      }
    );
    return response.result.data;
  },
};
