import { apiFetch } from "./client";

export interface LoginResponse {
  access_token: string;
  access_token_expires_at: string;
  refresh_token: string;
  refresh_token_expires_at: string;
  user: {
    id: string;
    business_id: string;
    name: string;
    email: string;
    role: "admin" | "employee";
  };
}

/** POST /auth/login — throws ApiError(401) on wrong credentials or an inactive user. */
export function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export interface RefreshResponse {
  access_token: string;
  access_token_expires_at: string;
  refresh_token: string;
  refresh_token_expires_at: string;
}

/**
 * POST /auth/refresh — exchanges a refresh token for a new access/refresh
 * pair. The API rotates the refresh token on every call: the one passed in
 * is revoked, so only the newly returned one remains valid.
 */
export function refreshTokens(refreshToken: string): Promise<RefreshResponse> {
  return apiFetch<RefreshResponse>("/auth/refresh", {
    method: "POST",
    body: { refresh_token: refreshToken },
  });
}

/** POST /auth/logout — revokes the given refresh token. Idempotent. */
export function logout(refreshToken: string): Promise<void> {
  return apiFetch<void>("/auth/logout", {
    method: "POST",
    body: { refresh_token: refreshToken },
  });
}

export interface ForgotPasswordResponse {
  message: string;
}

/**
 * POST /auth/forgot-password — always responds the same way whether or not
 * the email is registered, so `message` is safe to show verbatim without
 * leaking which emails exist.
 */
export function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  return apiFetch<ForgotPasswordResponse>("/auth/forgot-password", {
    method: "POST",
    body: { email },
  });
}

/**
 * POST /auth/reset-password — throws ApiError(401) if the token is unknown,
 * expired, or already used.
 */
export function resetPassword(token: string, password: string): Promise<void> {
  return apiFetch<void>("/auth/reset-password", {
    method: "POST",
    body: { token, password },
  });
}
