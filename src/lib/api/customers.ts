import { authFetch } from "@/lib/auth/session";

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  /** Null for a walk-in customer booked without one (see createWalkInAppointment). */
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
  banned_at: string | null;
  ban_reason: string | null;
  /** Rolling count, not a calendar reset: a miss stops counting once it's more than 30 days old. */
  missed_appointments_last_30_days: number;
}

/** GET /customers/{id} additionally carries all-time totals, never windowed or reset. */
export interface CustomerDetail extends Customer {
  total_appointments: number;
  completed_appointments: number;
  missed_appointments_all_time: number;
}

/**
 * GET /customers — lists the caller's customers, or those matching `q`
 * against name or phone, case-insensitive. An admin sees the whole
 * business; an employee sees only customers they've personally served,
 * and only once granted the view_customers permission (a 403 otherwise).
 */
export function listCustomers(q?: string): Promise<Customer[]> {
  return authFetch<Customer[]>("/customers", {
    params: q ? { q } : undefined,
  });
}

/**
 * GET /customers/{id} — a single customer, scoped the same way
 * listCustomers is. Throws ApiError(404) if unknown or out of scope.
 */
export function getCustomer(id: string): Promise<CustomerDetail> {
  return authFetch<CustomerDetail>(`/customers/${encodeURIComponent(id)}`);
}

export interface CustomerLookup {
  found: boolean;
  name?: string;
}

/**
 * GET /customers/lookup — whether phone already belongs to a customer in
 * the caller's own business, and their name if so. Any authenticated
 * role, not gated by view_customers. Used by the walk-in dialog to
 * pre-fill a name once a matching phone is entered.
 */
export function lookupCustomerByPhone(phone: string): Promise<CustomerLookup> {
  return authFetch<CustomerLookup>("/customers/lookup", { params: { phone } });
}

/**
 * POST /customers/{id}/ban — blocks this customer from booking any future
 * appointment; never touches their existing ones. Requires the admin
 * role, or an employee with the ban_customers permission who has served
 * this customer.
 */
export function banCustomer(id: string, reason: string): Promise<Customer> {
  return authFetch<Customer>(`/customers/${encodeURIComponent(id)}/ban`, {
    method: "POST",
    body: { reason },
  });
}

/** POST /customers/{id}/unban — lifts a ban. Same auth requirement as banCustomer. */
export function unbanCustomer(id: string): Promise<Customer> {
  return authFetch<Customer>(`/customers/${encodeURIComponent(id)}/unban`, {
    method: "POST",
  });
}
