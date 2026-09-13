import { authFetch } from "@/lib/auth/session";

export interface Service {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  created_at: string;
  updated_at: string;
  /** Which employees are associated with (bookable for) this service. Nobody can book it until this has at least one entry. */
  employee_ids: string[];
}

export interface CreateServiceParams {
  name: string;
  description?: string;
  duration_minutes: number;
  /** Decimal string, e.g. "25.00". Required: every service must have a price. */
  price: string;
  /** Admin-only: ignored for an employee caller, whose new service is always self-associated. */
  employee_ids?: string[];
}

/** POST /services — creates a service in the caller's own business. Requires the admin role, or an employee with manage_services. */
export function createService(params: CreateServiceParams): Promise<Service> {
  return authFetch<Service>("/services", { method: "POST", body: params });
}

/** GET /services — lists every service in the caller's own business. Any authenticated role. */
export function listServices(): Promise<Service[]> {
  return authFetch<Service[]>("/services");
}

export interface UpdateServiceParams {
  name?: string;
  description?: string;
  duration_minutes?: number;
  /** Decimal string, e.g. "25.00". */
  price?: string;
  /** Replaces the service's entire employee association set. Admin-only — an employee caller must never send this field. */
  employee_ids?: string[];
}

/** PATCH /services/{id} — updates only the given fields. Requires the admin role, or an employee with manage_services acting on their own service. */
export function updateService(
  id: string,
  patch: UpdateServiceParams,
): Promise<Service> {
  return authFetch<Service>(`/services/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
}

/**
 * DELETE /services/{id} — permanent and one-way: there's no reversible
 * active/inactive state, the service just disappears from `listServices`
 * for good and can never be edited again. Requires the admin role.
 */
export function deleteService(id: string): Promise<void> {
  return authFetch<void>(`/services/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
