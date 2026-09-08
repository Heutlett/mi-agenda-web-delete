/**
 * Client-side storage for the admin dashboard's JWT bearer tokens.
 * mi-agenda-api's auth is stateless Bearer-token based, not cookie-session
 * based, so `localStorage` is the natural fit here rather than a cookie.
 */

const ACCESS_TOKEN_KEY = "mi-agenda:access_token";
const REFRESH_TOKEN_KEY = "mi-agenda:refresh_token";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export function storeTokens({ accessToken, refreshToken }: StoredTokens): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}
