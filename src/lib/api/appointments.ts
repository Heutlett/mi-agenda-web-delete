import { authFetch } from "@/lib/auth/session";
import { apiFetch } from "./client";

export type AppointmentStatus = "CONFIRMED" | "CANCELLED" | "COMPLETED" | "MISSED";

export interface Appointment {
  id: string;
  business_id: string;
  employee_id: string;
  service_id: string;
  customer_id: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  notes: string | null;
  /**
   * Captured from the service's own price at booking time, independent of
   * it afterward — a later change to the service's price never
   * retroactively shifts an already-booked appointment's recorded price.
   * Editable via updateAppointment. Null if the service had no price set.
   */
  price: number | null;
  /** Whether that price has actually been collected, independent of the amount itself. Starts PENDING on every new booking. Editable via updateAppointment. */
  payment_status: PaymentStatus;
  created_at: string;
  updated_at: string;
}

export type PaymentStatus = "PAID" | "PENDING" | "OVERDUE" | "NOT_APPLICABLE";

export interface CreateAppointmentParams {
  businessSlug: string;
  employeeId: string;
  serviceId: string;
  startTime: string;
  customer: {
    name: string;
    phone: string;
    email?: string;
  };
}

/**
 * POST /appointments — books the appointment. Throws ApiError(409) if the
 * requested time is no longer open, whether it never was or was taken by
 * another booking since the client last checked availability.
 */
export function createAppointment(
  params: CreateAppointmentParams,
): Promise<Appointment> {
  return apiFetch<Appointment>("/appointments", {
    method: "POST",
    body: {
      business_slug: params.businessSlug,
      employee_id: params.employeeId,
      service_id: params.serviceId,
      start_time: params.startTime,
      customer: {
        name: params.customer.name,
        phone: params.customer.phone,
        ...(params.customer.email ? { email: params.customer.email } : {}),
      },
    },
  });
}

export interface CreateWalkInAppointmentParams {
  /** Required for an admin caller; omitted for an employee, who is always booked under their own employee record instead. */
  employeeId?: string;
  serviceId: string;
  startTime: string;
  customer: {
    name: string;
    /** Optional: staff are physically vouching for the customer, so unlike createAppointment there's no verification to tie a phone to. */
    phone?: string;
  };
}

/**
 * POST /appointments/walk-in — books an appointment for a customer being
 * served on the spot. Authenticated, unlike createAppointment above, and
 * skips phone verification entirely: staff are physically vouching for the
 * customer already there. Throws ApiError(409) if the requested time
 * overlaps an existing appointment/block or falls outside working hours.
 */
export function createWalkInAppointment(
  params: CreateWalkInAppointmentParams,
): Promise<Appointment> {
  return authFetch<Appointment>("/appointments/walk-in", {
    method: "POST",
    body: {
      ...(params.employeeId ? { employee_id: params.employeeId } : {}),
      service_id: params.serviceId,
      start_time: params.startTime,
      customer: {
        name: params.customer.name,
        ...(params.customer.phone ? { phone: params.customer.phone } : {}),
      },
    },
  });
}

export interface ListAppointmentsParams {
  employeeId?: string;
  customerId?: string;
  serviceId?: string;
  /** Calendar date in the business's own timezone, "YYYY-MM-DD". */
  startDate?: string;
  /** Calendar date in the business's own timezone, "YYYY-MM-DD". */
  endDate?: string;
  status?: AppointmentStatus;
  paymentStatus?: PaymentStatus;
}

/**
 * GET /appointments — an admin sees every appointment in their business; an
 * employee sees only their own, regardless of `employeeId`. Requires a
 * valid session.
 */
export function listAppointments(
  params: ListAppointmentsParams = {},
): Promise<Appointment[]> {
  return authFetch<Appointment[]>("/appointments", {
    params: {
      employee_id: params.employeeId,
      customer_id: params.customerId,
      service_id: params.serviceId,
      start_date: params.startDate,
      end_date: params.endDate,
      status: params.status,
      payment_status: params.paymentStatus,
    },
  });
}

export interface AppointmentDetail {
  id: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  notes: string | null;
  /** See Appointment.price; independent of the embedded service's own price. */
  price: number | null;
  payment_status: PaymentStatus;
  created_at: string;
  updated_at: string;
  employee: { id: string; name: string };
  service: {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    price: number;
  };
  customer: { id: string; name: string; phone: string | null; email: string | null };
}

/**
 * GET /appointments/{id} — the same appointment `listAppointments` returns
 * by id, but with employee/service/customer embedded instead of bare ids.
 * An employee caller can only fetch their own appointment. Requires a valid
 * session.
 */
export function getAppointmentDetail(id: string): Promise<AppointmentDetail> {
  return authFetch<AppointmentDetail>(
    `/appointments/${encodeURIComponent(id)}`,
  );
}

export interface UpdateAppointmentParams {
  status?: AppointmentStatus;
  /** A decimal string, e.g. "18.50". Corrects the price captured at booking time. */
  price?: string;
  /** Whether the price has actually been collected, independent of the amount itself. */
  payment_status?: PaymentStatus;
}

/**
 * PATCH /appointments/{id} — sets an appointment's status, price,
 * payment_status, or any combination in one request; at least one is
 * required.
 *
 * status: an admin, or an employee with the edit_appointment_status
 * permission, can set it to any status regardless of its current one; a
 * plain employee is restricted to the original one-way CONFIRMED →
 * CANCELLED/COMPLETED/MISSED (a 400 if they try to set it back to
 * CONFIRMED). Throws ApiError(409) if a plain employee's appointment is no
 * longer CONFIRMED (already moved, or a concurrent request), or if
 * reviving a CANCELLED appointment collides with another one now
 * occupying that slot.
 *
 * price: no extra permission — the same caller who can reach this
 * appointment at all can correct its price.
 *
 * payment_status: same no-extra-permission rule as price.
 *
 * All three are scoped the same way: an admin can update any appointment
 * in their business, an employee only their own.
 */
export function updateAppointment(
  id: string,
  params: UpdateAppointmentParams,
): Promise<Appointment> {
  return authFetch<Appointment>(`/appointments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: params,
  });
}

export interface GetRevenueTotalParams {
  /** Calendar date in the business's own timezone, "YYYY-MM-DD". */
  startDate: string;
  /** Calendar date in the business's own timezone, "YYYY-MM-DD". */
  endDate: string;
  employeeId?: string;
}

export interface RevenueTotal {
  /** Null only if the caller is an employee not linked to any employee record. */
  total: number | null;
}

/**
 * GET /appointments/totals — sums price across this business's COMPLETED
 * appointments in [startDate, endDate], both required. An employee always
 * gets their own total regardless of employeeId; an admin gets one
 * employee's total (employeeId) or, with none given, the business-wide
 * total across every employee. The caller decides what "day", "week", or
 * "month" means by choosing the date range.
 */
export function getRevenueTotal(
  params: GetRevenueTotalParams,
): Promise<RevenueTotal> {
  return authFetch<RevenueTotal>("/appointments/totals", {
    params: {
      start_date: params.startDate,
      end_date: params.endDate,
      employee_id: params.employeeId,
    },
  });
}
