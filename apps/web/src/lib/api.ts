export class ApiError extends Error {
  constructor(public payload: unknown, public status: number) {
    super(`api error ${status}`);
    this.name = "ApiError";
  }
}

class ApiClient {
  private base: string;

  constructor(base: string = "/api/v1") {
    this.base = base;
  }

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new ApiError(payload, res.status);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  get<T>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>(path, { method: "GET", ...init });
  }
  post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...init,
    });
  }
  put<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...init,
    });
  }
  patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...init,
    });
  }
  del<T>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>(path, { method: "DELETE", ...init });
  }

  postForm<T>(path: string, form: FormData, init?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: form,
      headers: { ...(init?.headers ?? {}) },
      ...init,
    });
  }
}

export const api = new ApiClient();
