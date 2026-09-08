import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "./client";

const originalEnv = process.env.NEXT_PUBLIC_API_URL;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:3000";
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  process.env.NEXT_PUBLIC_API_URL = originalEnv;
  vi.unstubAllGlobals();
});

function mockResponse(init: {
  ok: boolean;
  status: number;
  statusText?: string;
  json?: unknown;
  text?: string;
}) {
  return {
    ok: init.ok,
    status: init.status,
    statusText: init.statusText ?? "",
    json: async () => init.json,
    text: async () => init.text ?? "",
  } as Response;
}

describe("apiFetch", () => {
  it("returns the parsed JSON body on success", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ ok: true, status: 200, json: { id: "abc" } }),
    );

    const result = await apiFetch<{ id: string }>("/businesses/acme");

    expect(result).toEqual({ id: "abc" });
  });

  it("returns undefined for a 204 No Content response", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ ok: true, status: 204 }));

    const result = await apiFetch("/auth/logout", { method: "POST", body: {} });

    expect(result).toBeUndefined();
  });

  it("throws ApiError with the status and plain-text message on failure", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ ok: false, status: 404, text: "not found\n" }),
    );

    await expect(apiFetch("/businesses/unknown")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "not found",
    });
    await expect(apiFetch("/businesses/unknown")).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it("falls back to statusText when the error body is empty", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: "",
      }),
    );

    await expect(apiFetch("/businesses/acme")).rejects.toMatchObject({
      status: 500,
      message: "Internal Server Error",
    });
  });

  it("builds the request URL with query params, skipping undefined values", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ ok: true, status: 200, json: [] }),
    );

    await apiFetch("/appointments", {
      params: {
        employee_id: "e1",
        status: undefined,
        start_date: "2026-09-10",
      },
    });

    const [calledUrl] = vi.mocked(fetch).mock.calls[0];
    const url = new URL(calledUrl as string);
    expect(url.pathname).toBe("/appointments");
    expect(url.searchParams.get("employee_id")).toBe("e1");
    expect(url.searchParams.get("start_date")).toBe("2026-09-10");
    expect(url.searchParams.has("status")).toBe(false);
  });

  it("sends a Bearer token and JSON content type when a body is present", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ ok: true, status: 200, json: {} }),
    );

    await apiFetch("/employees", {
      method: "POST",
      body: { user_id: "u1" },
      token: "access-token",
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer access-token");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify({ user_id: "u1" }));
  });

  it("throws a clear error when NEXT_PUBLIC_API_URL is not set", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;

    await expect(apiFetch("/businesses/acme")).rejects.toThrow(
      /NEXT_PUBLIC_API_URL/,
    );
  });
});
