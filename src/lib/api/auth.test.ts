import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgotPassword,
  login,
  logout,
  refreshTokens,
  resetPassword,
} from "./auth";
import { ApiError } from "./client";

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:3000";
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("login", () => {
  it("POSTs email and password to /auth/login", async () => {
    const body = {
      access_token: "a",
      access_token_expires_at: "2026-01-01T00:00:00Z",
      refresh_token: "r",
      refresh_token_expires_at: "2026-02-01T00:00:00Z",
      user: {
        id: "u1",
        business_id: "b1",
        name: "Alice",
        email: "alice@example.com",
        role: "admin",
      },
    };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    } as Response);

    const result = await login("alice@example.com", "hunter2");

    const [calledUrl, init] = vi.mocked(fetch).mock.calls[0];
    expect(new URL(calledUrl as string).pathname).toBe("/auth/login");
    expect(JSON.parse(init?.body as string)).toEqual({
      email: "alice@example.com",
      password: "hunter2",
    });
    expect(result).toEqual(body);
  });

  it("propagates a 401 as ApiError", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "invalid credentials\n",
    } as Response);

    await expect(login("alice@example.com", "wrong")).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

describe("refreshTokens", () => {
  it("POSTs the refresh token to /auth/refresh", async () => {
    const body = {
      access_token: "a2",
      access_token_expires_at: "2026-01-01T00:00:00Z",
      refresh_token: "r2",
      refresh_token_expires_at: "2026-02-01T00:00:00Z",
    };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    } as Response);

    const result = await refreshTokens("old-refresh-token");

    const [calledUrl, init] = vi.mocked(fetch).mock.calls[0];
    expect(new URL(calledUrl as string).pathname).toBe("/auth/refresh");
    expect(JSON.parse(init?.body as string)).toEqual({
      refresh_token: "old-refresh-token",
    });
    expect(result).toEqual(body);
  });

  it("propagates a 401 as ApiError when the refresh token is invalid", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "invalid refresh token\n",
    } as Response);

    await expect(refreshTokens("stale-token")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("logout", () => {
  it("POSTs the refresh token to /auth/logout", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 204 } as Response);

    await logout("some-refresh-token");

    const [calledUrl, init] = vi.mocked(fetch).mock.calls[0];
    expect(new URL(calledUrl as string).pathname).toBe("/auth/logout");
    expect(JSON.parse(init?.body as string)).toEqual({
      refresh_token: "some-refresh-token",
    });
  });
});

describe("forgotPassword", () => {
  it("POSTs the email and returns the server's own message verbatim", async () => {
    const body = {
      message: "if that email exists, a password reset link has been sent",
    };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    } as Response);

    const result = await forgotPassword("alice@example.com");

    const [calledUrl, init] = vi.mocked(fetch).mock.calls[0];
    expect(new URL(calledUrl as string).pathname).toBe("/auth/forgot-password");
    expect(JSON.parse(init?.body as string)).toEqual({
      email: "alice@example.com",
    });
    expect(result).toEqual(body);
  });
});

describe("resetPassword", () => {
  it("POSTs the token and new password to /auth/reset-password", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 204 } as Response);

    await resetPassword("a-reset-token", "new-password-123");

    const [calledUrl, init] = vi.mocked(fetch).mock.calls[0];
    expect(new URL(calledUrl as string).pathname).toBe("/auth/reset-password");
    expect(JSON.parse(init?.body as string)).toEqual({
      token: "a-reset-token",
      password: "new-password-123",
    });
  });

  it("propagates a 401 as ApiError for an invalid or expired token", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "invalid reset token\n",
    } as Response);

    await expect(
      resetPassword("stale-token", "new-password-123"),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
