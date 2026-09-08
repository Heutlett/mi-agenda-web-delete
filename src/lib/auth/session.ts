import { routing } from "@/i18n/routing";
import { logout as apiLogout, refreshTokens } from "@/lib/api/auth";
import { ApiError, apiFetch, type ApiRequestOptions } from "@/lib/api/client";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  storeTokens,
} from "./tokens";

/** Thrown when there's no valid session left — no stored token, or the refresh token itself was rejected. */
export class SessionExpiredError extends Error {
  constructor() {
    super("Your session has expired. Please sign in again.");
    this.name = "SessionExpiredError";
  }
}

/** Splits a pathname into its leading locale segment (if any) and the rest. */
function splitLocale(pathname: string): { locale: string; rest: string } {
  const match = pathname.match(/^\/([a-zA-Z-]+)(\/.*)?$/);
  const candidate = match?.[1];
  if (candidate && (routing.locales as readonly string[]).includes(candidate)) {
    return { locale: candidate, rest: match?.[2] ?? "/" };
  }
  return { locale: routing.defaultLocale, rest: pathname };
}

/**
 * Redirects to login, preserving the current admin path as `?next=` so a
 * successful re-login can return the user where they were. A full
 * navigation, not a client-side one, since this needs to work from plain
 * modules like this one, outside any React component's router access.
 */
export function redirectToLogin(currentPath?: string): void {
  if (typeof window === "undefined") return;
  const { locale, rest } = splitLocale(currentPath ?? window.location.pathname);
  const query = rest.startsWith("/admin")
    ? `?next=${encodeURIComponent(rest)}`
    : "";
  // This module has no React component/router context (called from plain async
  // code, e.g. authFetch), so window.location is the only way to navigate here.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = `/${locale}/admin/login${query}`;
}

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Refreshes the access token, sharing one in-flight request across any
 * calls that race into a 401 at the same time. The API rotates the refresh
 * token on every use, so two independent refresh calls would have the
 * second one fail against an already-revoked token.
 */
function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const result = await refreshTokens(refreshToken);
    storeTokens({
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
    });
    return result.access_token;
  } catch {
    clearTokens();
    return null;
  }
}

/**
 * Like `apiFetch`, but attaches the stored access token and transparently
 * retries once after a silent refresh if the access token has expired.
 * Throws `SessionExpiredError` when there's no session to attach, or the
 * refresh itself fails, so callers can redirect to login.
 */
export async function authFetch<T = void>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const accessToken = getAccessToken();
  if (!accessToken) {
    redirectToLogin();
    throw new SessionExpiredError();
  }

  try {
    return await apiFetch<T>(path, { ...options, token: accessToken });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;

    const newAccessToken = await refreshAccessToken();
    if (!newAccessToken) {
      redirectToLogin();
      throw new SessionExpiredError();
    }

    return apiFetch<T>(path, { ...options, token: newAccessToken });
  }
}

/** Revokes the current refresh token server-side and clears the local session either way. */
export async function logoutSession(): Promise<void> {
  const refreshToken = getRefreshToken();
  clearTokens();

  if (refreshToken) {
    await apiLogout(refreshToken).catch(() => {
      // Best-effort: the local session is already cleared regardless.
    });
  }
}
