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
  status: "active" | "inactive";
}

export interface CreateScheduleParams {
  employee_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

/** POST /schedules — adds a weekly working-hours block for an employee. Requires the admin role. */
export function createSchedule(
  params: CreateScheduleParams,
): Promise<Schedule> {
  return authFetch<Schedule>("/schedules", { method: "POST", body: params });
}

/** GET /schedules — lists schedules in the caller's own business, optionally filtered to one employee. Requires the admin role. */
export function listSchedules(employeeId?: string): Promise<Schedule[]> {
  return authFetch<Schedule[]>("/schedules", {
    params: employeeId ? { employee_id: employeeId } : undefined,
  });
}

export interface UpdateScheduleParams {
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  status?: "active" | "inactive";
}

/** PATCH /schedules/{id} — updates only the given fields. Requires the admin role. */
export function updateSchedule(
  id: string,
  patch: UpdateScheduleParams,
): Promise<Schedule> {
  return authFetch<Schedule>(`/schedules/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
}

/** DELETE /schedules/{id} — deactivates the schedule (sets status to inactive; does not delete the record). Requires the admin role. */
export function deactivateSchedule(id: string): Promise<void> {
  return authFetch<void>(`/schedules/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
