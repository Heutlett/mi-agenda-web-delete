import type { Schedule } from "@/lib/api/schedules";

/**
 * Whether a professional has at least one schedule row at all — the bar
 * for "this professional can be booked at all." Used to fail fast (warn
 * before a form is even shown) rather than let an admin fill out a whole
 * appointment for someone who was never given working hours.
 */
export function employeeHasActiveSchedule(schedules: Schedule[]): boolean {
  return schedules.length > 0;
}

/** Employee ids, out of a schedules list spanning multiple professionals, with at least one schedule row. */
export function employeeIdsWithActiveSchedule(
  schedules: Schedule[],
): Set<string> {
  return new Set(schedules.map((s) => s.employee_id));
}
