import { authFetch } from "@/lib/auth/session";

export interface Service {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface CreateServiceParams {
  name: string;
  description?: string;
  duration_minutes: number;
  /** Decimal string, e.g. "25.00". Required: every service must have a price. */
  price: string;
}

/** POST /services — creates a service in the caller's own business. Requires the admin role. */
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
  status?: "active" | "inactive";
}

/** PATCH /services/{id} — updates only the given fields. Requires the admin role. */
export function updateService(
  id: string,
  patch: UpdateServiceParams,
): Promise<Service> {
  return authFetch<Service>(`/services/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
}

/** DELETE /services/{id} — deactivates the service (sets status to inactive; does not delete the record). Requires the admin role. */
export function deactivateService(id: string): Promise<void> {
  return authFetch<void>(`/services/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
