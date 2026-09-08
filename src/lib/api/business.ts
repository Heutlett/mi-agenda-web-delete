import { authFetch } from "@/lib/auth/session";
import { apiFetch } from "./client";

export interface Business {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  max_appointments_per_customer_per_day: number;
  max_appointments_per_customer_per_week: number;
  /** Purely presentational, shown alongside every price/total this business's prices are displayed with. Defaults to "₡". */
  currency_symbol: string;
  /** Whether customers see any service prices on the public booking page. Business-wide, not per-service. Change via updateBusinessPriceVisibility, not updateBusiness. */
  show_service_prices: boolean;
}

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number | null;
}

export interface PublicEmployee {
  id: string;
  name: string;
}

export interface PublicBusiness extends Business {
  services: PublicService[];
  employees: PublicEmployee[];
}

/** GET /businesses/{slug} — throws ApiError(404) if the slug is unknown or inactive. */
export function getBusinessBySlug(slug: string): Promise<PublicBusiness> {
  return apiFetch<PublicBusiness>(`/businesses/${encodeURIComponent(slug)}`);
}

/** GET /businesses/me — the authenticated caller's own business. Any authenticated role can call this. */
export function getMyBusiness(): Promise<Business> {
  return authFetch<Business>("/businesses/me");
}

export interface UpdateBusinessParams {
  name?: string;
  slug?: string;
  phone?: string;
  email?: string;
  address?: string;
  timezone?: string;
  status?: "active" | "inactive";
  max_appointments_per_customer_per_day?: number;
  max_appointments_per_customer_per_week?: number;
  currency_symbol?: string;
}

/**
 * PATCH /businesses/{id} — updates only the given fields; omit a key
 * entirely to leave it unchanged. Requires the admin role and that `id`
 * matches the caller's own business (a mismatch responds 404, same as a
 * nonexistent business).
 */
export function updateBusiness(
  id: string,
  patch: UpdateBusinessParams,
): Promise<Business> {
  return authFetch<Business>(`/businesses/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
}

/**
 * PATCH /businesses/{id}/price-visibility — a separate, narrower endpoint
 * than updateBusiness so it can be reached by an admin or an employee with
 * the manage_price_visibility permission, without exposing every other
 * business setting to that employee.
 */
export function updateBusinessPriceVisibility(
  id: string,
  showServicePrices: boolean,
): Promise<Business> {
  return authFetch<Business>(
    `/businesses/${encodeURIComponent(id)}/price-visibility`,
    { method: "PATCH", body: { show_service_prices: showServicePrices } },
  );
}
