/**
 * Thin, typed wrapper around `fetch` for calls to mi-agenda-api.
 *
 * mi-agenda-api's error responses are plain text (`net/http.Error`), never a
 * JSON envelope, so failures surface as an `ApiError` carrying the raw
 * status and message text rather than a parsed body.
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type ApiQueryParams = Record<
  string,
  string | number | boolean | undefined
>;

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  params?: ApiQueryParams;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Copy .env.example to .env.local and set it.",
    );
  }
  return url.replace(/\/+$/, "");
}

function buildUrl(path: string, params?: ApiQueryParams): string {
  const url = new URL(`${getBaseUrl()}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Issues one request against mi-agenda-api and returns its JSON body typed
 * as `T`. Any non-2xx status throws `ApiError` with that status and the
 * response's plain-text message.
 */
export async function apiFetch<T = void>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = "GET", params, body, token, headers, signal } = options;
  const hasBody = body !== undefined;

  const response = await fetch(buildUrl(path, params), {
    method,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: hasBody ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const message = (await response.text()).trim() || response.statusText;
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
