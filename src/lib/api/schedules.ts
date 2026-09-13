import { authFetch } from "@/lib/auth/session";

export interface Schedule {
  id: string;
  employee_id: string;
  /** 0 (Sunday) through 6 (Saturday). */
  day_of_week: number;
  /** Wall-clock time, "HH:MM". */
  start_time: string;
  /** Wall-clock time, "HH:MM". */
  end_time: string;
  /** Null when this schedule has no recurring lunch break. */
  lunch_start: string | null;
  /** Null when this schedule has no recurring lunch break. */
  lunch_end: string | null;
}

export interface CreateScheduleParams {
  employee_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  /** Must be given together with lunch_end, or omitted entirely. */
  lunch_start?: string;
  lunch_end?: string;
}

/** POST /schedules — adds a weekly working-hours block for an employee. Requires the admin role, or an employee with manage_schedule. */
export function createSchedule(
  params: CreateScheduleParams,
): Promise<Schedule> {
  return authFetch<Schedule>("/schedules", { method: "POST", body: params });
}

/** GET /schedules — lists schedules in the caller's own business, optionally filtered to one employee. Any authenticated role. */
export function listSchedules(employeeId?: string): Promise<Schedule[]> {
  return authFetch<Schedule[]>("/schedules", {
    params: employeeId ? { employee_id: employeeId } : undefined,
  });
}

export interface UpdateScheduleParams {
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  /** Must be given together with lunch_end. Replaces the schedule's entire lunch window. */
  lunch_start?: string;
  lunch_end?: string;
  /** Clears an existing lunch break entirely. Mutually exclusive with lunch_start/lunch_end in the same request. */
  remove_lunch?: boolean;
}

/** PATCH /schedules/{id} — updates only the given fields. Requires the admin role, or an employee with manage_schedule acting on their own schedule. */
export function updateSchedule(
  id: string,
  patch: UpdateScheduleParams,
): Promise<Schedule> {
  return authFetch<Schedule>(`/schedules/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
}

/**
 * DELETE /schedules/{id} — permanent: the record is actually removed, not
 * just hidden (nothing else in the schema references a schedule by id, so
 * there's no history this could orphan). Requires the admin role, or an
 * employee with manage_schedule acting on their own schedule.
 */
export function deleteSchedule(id: string): Promise<void> {
  return authFetch<void>(`/schedules/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export interface LunchSkip {
  id: string;
  employee_id: string;
  /** "YYYY-MM-DD". */
  date: string;
}

export interface CreateLunchSkipParams {
  /** Required for an admin caller, ignored for an employee caller (always their own record). */
  employee_id?: string;
  date: string;
}

/** POST /schedules/lunch-skips — records that the employee worked through their recurring lunch break on one date. Any authenticated role. */
export function createLunchSkip(
  params: CreateLunchSkipParams,
): Promise<LunchSkip> {
  return authFetch<LunchSkip>("/schedules/lunch-skips", {
    method: "POST",
    body: params,
  });
}

/** GET /schedules/lunch-skips — lists lunch skips with date in [startDate, endDate]. Any authenticated role, self-scoped for an employee. */
export function listLunchSkips(params: {
  employeeId?: string;
  startDate: string;
  endDate: string;
}): Promise<LunchSkip[]> {
  return authFetch<LunchSkip[]>("/schedules/lunch-skips", {
    params: {
      ...(params.employeeId ? { employee_id: params.employeeId } : {}),
      start_date: params.startDate,
      end_date: params.endDate,
    },
  });
}

/** DELETE /schedules/lunch-skips/{id} — restores the recurring lunch break for that one date. Any authenticated role, self-scoped for an employee. */
export function deleteLunchSkip(id: string): Promise<void> {
  return authFetch<void>(`/schedules/lunch-skips/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
