import { authFetch } from "@/lib/auth/session";

export type RecurringAppointmentStatus = "active" | "inactive";

/**
 * POST/GET/PATCH /recurring-appointments' shared response shape, with
 * employee/service/customer names embedded so the management page renders
 * without a per-row fetch.
 *
 * status is the *effective* status: it already reads "inactive" once
 * end_date has passed, even if nothing was ever written to flip it —
 * expiry is computed fresh by the backend on every read, never stored.
 * expired distinguishes that case from a rule an admin deliberately
 * turned off, so the UI can show the right message for each.
 */
export interface RecurringAppointment {
  id: string;
  customer_id: string;
  customer_name: string;
  employee_id: string;
  employee_name: string;
  service_id: string;
  service_name: string;
  /** 0-6, Sunday is 0 — matches Schedule's own day_of_week indexing. */
  day_of_week: number;
  start_time: string;
  interval_weeks: number;
  start_date: string;
  end_date: string;
  status: RecurringAppointmentStatus;
  expired: boolean;
}

export interface CreateRecurringAppointmentParams {
  customerId: string;
  /** Required for an admin caller; ignored for an employee, who is always the rule's own employee instead. */
  employeeId?: string;
  serviceId: string;
  dayOfWeek: number;
  startTime: string;
  intervalWeeks?: number;
  startDate: string;
  /** Required. At most one year after startDate — the backend enforces this and generates every occurrence in that span synchronously. */
  endDate: string;
}

/**
 * POST /recurring-appointments — creates a recurring rule tied to one
 * existing customer, and synchronously generates every occurrence from
 * startDate through endDate in this same request. There's no background
 * process picking rules up later.
 */
export function createRecurringAppointment(
  params: CreateRecurringAppointmentParams,
): Promise<RecurringAppointment> {
  return authFetch<RecurringAppointment>("/recurring-appointments", {
    method: "POST",
    body: {
      customer_id: params.customerId,
      ...(params.employeeId ? { employee_id: params.employeeId } : {}),
      service_id: params.serviceId,
      day_of_week: params.dayOfWeek,
      start_time: params.startTime,
      ...(params.intervalWeeks ? { interval_weeks: params.intervalWeeks } : {}),
      start_date: params.startDate,
      end_date: params.endDate,
    },
  });
}

/** A reason code on a previewed occurrence that wouldn't generate — see PreviewOccurrence.reason. */
export type PreviewSkipReason =
  | "service_deleted"
  | "not_offered"
  | "slot_unavailable"
  | "day_limit"
  | "week_limit";

export interface PreviewOccurrence {
  /** "YYYY-MM-DD". */
  date: string;
  wouldGenerate: boolean;
  /** Only set when wouldGenerate is false. */
  reason?: PreviewSkipReason;
}

/**
 * POST /recurring-appointments/preview — same body and validation as
 * createRecurringAppointment, but creates nothing. Reports, per candidate
 * date from startDate through endDate, whether it would actually get
 * booked right now and why not if it wouldn't (most commonly
 * "slot_unavailable", a conflict with something already on the
 * calendar) — meant to be called right before the real create, so a
 * caller can see and confirm any conflicts instead of only discovering
 * them afterward as gaps in the series.
 */
export function previewRecurringAppointment(
  params: CreateRecurringAppointmentParams,
): Promise<PreviewOccurrence[]> {
  return authFetch<
    { date: string; would_generate: boolean; reason?: PreviewSkipReason }[]
  >("/recurring-appointments/preview", {
    method: "POST",
    body: {
      customer_id: params.customerId,
      ...(params.employeeId ? { employee_id: params.employeeId } : {}),
      service_id: params.serviceId,
      day_of_week: params.dayOfWeek,
      start_time: params.startTime,
      ...(params.intervalWeeks ? { interval_weeks: params.intervalWeeks } : {}),
      start_date: params.startDate,
      end_date: params.endDate,
    },
  }).then((rows) =>
    rows.map((row) => ({
      date: row.date,
      wouldGenerate: row.would_generate,
      reason: row.reason,
    })),
  );
}

export interface ListRecurringAppointmentsParams {
  employeeId?: string;
  customerId?: string;
  /** Defaults to "active" server-side if omitted. "inactive" includes both manually deactivated and expired rules. */
  status?: RecurringAppointmentStatus | "all";
}

/**
 * GET /recurring-appointments — an admin sees every rule in their
 * business, optionally filtered; an employee sees only their own,
 * regardless of employeeId given.
 */
export function listRecurringAppointments(
  params: ListRecurringAppointmentsParams = {},
): Promise<RecurringAppointment[]> {
  return authFetch<RecurringAppointment[]>("/recurring-appointments", {
    params: {
      employee_id: params.employeeId,
      customer_id: params.customerId,
      status: params.status,
    },
  });
}

export interface UpdateRecurringAppointmentParams {
  status?: RecurringAppointmentStatus;
  serviceId?: string;
  dayOfWeek?: number;
  startTime?: string;
  intervalWeeks?: number;
  /**
   * Extending this past what's already been generated synchronously
   * generates the newly-covered occurrences in this same request. Also
   * how an expired rule (see RecurringAppointment.expired) is
   * reactivated — there's no separate action for that, just moving
   * end_date to a date on or after today.
   */
  endDate?: string;
}

/**
 * PATCH /recurring-appointments/{id} — customer_id and employee_id can
 * never be changed; deactivate and create a new rule instead. Setting
 * status to "inactive" only stops future generation, it never touches
 * occurrences already created.
 */
export function updateRecurringAppointment(
  id: string,
  params: UpdateRecurringAppointmentParams,
): Promise<RecurringAppointment> {
  return authFetch<RecurringAppointment>(
    `/recurring-appointments/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: {
        status: params.status,
        service_id: params.serviceId,
        day_of_week: params.dayOfWeek,
        start_time: params.startTime,
        interval_weeks: params.intervalWeeks,
        end_date: params.endDate,
      },
    },
  );
}
