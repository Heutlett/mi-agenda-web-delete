import { authFetch } from "@/lib/auth/session";

export interface Employee {
  id: string;
  business_id: string;
  user_id: string;
  name: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  permissions: string[];
}

/**
 * POST /employees — links an existing user (create it first with
 * createUser) to a new employee record. Requires the admin role. Throws
 * ApiError(409) if that user is already an employee.
 */
export function createEmployee(params: {
  userId: string;
  name?: string;
}): Promise<Employee> {
  return authFetch<Employee>("/employees", {
    method: "POST",
    body: {
      user_id: params.userId,
      ...(params.name ? { name: params.name } : {}),
    },
  });
}

/** GET /employees — lists every employee in the caller's own business. Requires the admin role. */
export function listEmployees(): Promise<Employee[]> {
  return authFetch<Employee[]>("/employees");
}

/**
 * GET /employees/me — the caller's own employee record, including their
 * granted permissions. Any authenticated role can call this; throws
 * ApiError(404) if the caller has no employees row (e.g. an admin who was
 * never also added as an employee).
 */
export function getCurrentEmployee(): Promise<Employee> {
  return authFetch<Employee>("/employees/me");
}

export interface UpdateEmployeeParams {
  name?: string;
  status?: "active" | "inactive";
  permissions?: string[];
}

/** PATCH /employees/{id} — updates only the given fields. Requires the admin role. */
export function updateEmployee(
  id: string,
  patch: UpdateEmployeeParams,
): Promise<Employee> {
  return authFetch<Employee>(`/employees/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
}

/** DELETE /employees/{id} — deactivates the employee (sets status to inactive; does not delete the record). Requires the admin role. */
export function deactivateEmployee(id: string): Promise<void> {
  return authFetch<void>(`/employees/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
