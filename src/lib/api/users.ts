import { authFetch } from "@/lib/auth/session";

export interface User {
  id: string;
  business_id: string;
  name: string;
  email: string;
  role: "admin" | "employee";
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface CreatedUser extends User {
  /** No email delivery yet: hand this to the new user so they can set their password via POST /auth/reset-password. */
  claim_token: string;
}

export interface CreateUserParams {
  name: string;
  email: string;
  role: "admin" | "employee";
}

/** POST /users — creates a user in the caller's own business. Requires the admin role. Throws ApiError(409) if the email is already in use. */
export function createUser(params: CreateUserParams): Promise<CreatedUser> {
  return authFetch<CreatedUser>("/users", { method: "POST", body: params });
}

/** GET /users — lists every user in the caller's own business. Requires the admin role. */
export function listUsers(): Promise<User[]> {
  return authFetch<User[]>("/users");
}
