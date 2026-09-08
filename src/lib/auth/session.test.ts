import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/client")>(
      "@/lib/api/client",
    );
  return { ...actual, apiFetch: vi.fn() };
});

vi.mock("@/lib/api/auth", () => ({
  refreshTokens: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("./tokens", () => ({
  getAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
  storeTokens: vi.fn(),
  clearTokens: vi.fn(),
}));

import { logout as apiLogout, refreshTokens } from "@/lib/api/auth";
import { ApiError, apiFetch } from "@/lib/api/client";
import { authFetch, logoutSession, SessionExpiredError } from "./session";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  storeTokens,
} from "./tokens";

const freshTokens = {
  access_token: "access-2",
  access_token_expires_at: "2026-01-01T00:00:00Z",
  refresh_token: "refresh-2",
  refresh_token_expires_at: "2026-02-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("authFetch", () => {
  it("throws SessionExpiredError without hitting the network when there's no access token", async () => {
    vi.mocked(getAccessToken).mockReturnValue(null);

    await expect(authFetch("/employees")).rejects.toBeInstanceOf(
      SessionExpiredError,
    );
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("attaches the stored access token and returns the result on success", async () => {
    vi.mocked(getAccessToken).mockReturnValue("access-1");
    vi.mocked(apiFetch).mockResolvedValue({ ok: true });

    const result = await authFetch("/employees");

    expect(result).toEqual({ ok: true });
    expect(apiFetch).toHaveBeenCalledWith(
      "/employees",
      expect.objectContaining({ token: "access-1" }),
    );
  });

  it("silently refreshes and retries once on a 401, using the new access token", async () => {
    vi.mocked(getAccessToken).mockReturnValue("expired-access");
    vi.mocked(getRefreshToken).mockReturnValue("refresh-1");
    vi.mocked(apiFetch)
      .mockRejectedValueOnce(new ApiError(401, "expired"))
      .mockResolvedValueOnce({ ok: true });
    vi.mocked(refreshTokens).mockResolvedValue(freshTokens);

    const result = await authFetch("/employees");

    expect(result).toEqual({ ok: true });
    expect(storeTokens).toHaveBeenCalledWith({
      accessToken: "access-2",
      refreshToken: "refresh-2",
    });
    expect(apiFetch).toHaveBeenLastCalledWith(
      "/employees",
      expect.objectContaining({ token: "access-2" }),
    );
  });

  it("throws SessionExpiredError and clears tokens when the refresh itself fails", async () => {
    vi.mocked(getAccessToken).mockReturnValue("expired-access");
    vi.mocked(getRefreshToken).mockReturnValue("refresh-1");
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(401, "expired"));
    vi.mocked(refreshTokens).mockRejectedValue(
      new ApiError(401, "invalid refresh token"),
    );

    await expect(authFetch("/employees")).rejects.toBeInstanceOf(
      SessionExpiredError,
    );
    expect(clearTokens).toHaveBeenCalled();
  });

  it("throws SessionExpiredError without refreshing when there's no refresh token to use", async () => {
    vi.mocked(getAccessToken).mockReturnValue("expired-access");
    vi.mocked(getRefreshToken).mockReturnValue(null);
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(401, "expired"));

    await expect(authFetch("/employees")).rejects.toBeInstanceOf(
      SessionExpiredError,
    );
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it("propagates non-401 errors without attempting a refresh", async () => {
    vi.mocked(getAccessToken).mockReturnValue("access-1");
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(500, "server error"));

    await expect(authFetch("/employees")).rejects.toMatchObject({
      status: 500,
    });
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it("shares one in-flight refresh across requests that 401 concurrently", async () => {
    vi.mocked(getAccessToken).mockReturnValue("expired-access");
    vi.mocked(getRefreshToken).mockReturnValue("refresh-1");
    vi.mocked(apiFetch).mockImplementation(async (_path, options) => {
      if (options?.token === "expired-access")
        throw new ApiError(401, "expired");
      return { ok: true };
    });

    let resolveRefresh!: (value: typeof freshTokens) => void;
    vi.mocked(refreshTokens).mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    const call1 = authFetch("/a");
    const call2 = authFetch("/b");

    // Let both requests hit their 401 and start (or join) the refresh.
    await Promise.resolve();
    await Promise.resolve();
    expect(refreshTokens).toHaveBeenCalledTimes(1);

    resolveRefresh(freshTokens);
    await Promise.all([call1, call2]);

    expect(refreshTokens).toHaveBeenCalledTimes(1);
  });
});

describe("authFetch redirects to login with the return path preserved", () => {
  let mockLocation: { pathname: string; href: string };

  beforeEach(() => {
    mockLocation = { pathname: "/en/admin/employees", href: "" };
    vi.stubGlobal("window", { location: mockLocation });
  });

  it("redirects when there's no access token at all", async () => {
    vi.mocked(getAccessToken).mockReturnValue(null);

    await expect(authFetch("/employees")).rejects.toBeInstanceOf(
      SessionExpiredError,
    );

    expect(mockLocation.href).toBe(
      "/en/admin/login?next=%2Fadmin%2Femployees",
    );
  });

  it("redirects when the silent refresh ultimately fails", async () => {
    vi.mocked(getAccessToken).mockReturnValue("expired-access");
    vi.mocked(getRefreshToken).mockReturnValue("refresh-1");
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(401, "expired"));
    vi.mocked(refreshTokens).mockRejectedValue(
      new ApiError(401, "invalid refresh token"),
    );

    await expect(authFetch("/employees")).rejects.toBeInstanceOf(
      SessionExpiredError,
    );

    expect(mockLocation.href).toBe(
      "/en/admin/login?next=%2Fadmin%2Femployees",
    );
  });

  it("does not redirect when the request simply succeeds", async () => {
    vi.mocked(getAccessToken).mockReturnValue("access-1");
    vi.mocked(apiFetch).mockResolvedValue({ ok: true });

    await authFetch("/employees");

    expect(mockLocation.href).toBe("");
  });
});

describe("logoutSession", () => {
  it("clears tokens and calls the logout endpoint when a refresh token exists", async () => {
    vi.mocked(getRefreshToken).mockReturnValue("refresh-1");
    vi.mocked(apiLogout).mockResolvedValue(undefined);

    await logoutSession();

    expect(clearTokens).toHaveBeenCalled();
    expect(apiLogout).toHaveBeenCalledWith("refresh-1");
  });

  it("still clears tokens locally even if the logout call fails", async () => {
    vi.mocked(getRefreshToken).mockReturnValue("refresh-1");
    vi.mocked(apiLogout).mockRejectedValue(new Error("network down"));

    await expect(logoutSession()).resolves.toBeUndefined();
    expect(clearTokens).toHaveBeenCalled();
  });

  it("skips the API call when there's no refresh token, but still clears local state", async () => {
    vi.mocked(getRefreshToken).mockReturnValue(null);

    await logoutSession();

    expect(clearTokens).toHaveBeenCalled();
    expect(apiLogout).not.toHaveBeenCalled();
  });
});
