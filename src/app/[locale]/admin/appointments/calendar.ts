import type { AppointmentStatus } from "@/lib/api/appointments";
import { addDays } from "@/lib/date";

export type ViewMode = "week" | "day" | "list";

export interface CalendarUrlParams {
  view?: ViewMode;
  date?: string;
  employee?: string;
  start?: string;
  end?: string;
  status?: AppointmentStatus;
  /** Cancelled appointments are hidden by default on the calendar (week/day) view; only encoded in the URL when explicitly shown. */
  showCancelled?: boolean;
}

/** Builds `/admin/appointments` with only the given, defined query params, in a stable order. */
export function calendarUrl(params: CalendarUrlParams): string {
  const qs = new URLSearchParams();
  if (params.view) qs.set("view", params.view);
  if (params.date) qs.set("date", params.date);
  if (params.employee) qs.set("employee", params.employee);
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  if (params.status) qs.set("status", params.status);
  if (params.showCancelled) qs.set("cancelled", "show");
  const query = qs.toString();
  return `/admin/appointments${query ? `?${query}` : ""}`;
}

/** Whether cancelled appointments should be shown on the calendar view; false (hidden) unless the URL says otherwise. */
export function parseShowCancelledParam(cancelledParam: string | null): boolean {
  return cancelledParam === "show";
}

/** Parses a "YYYY-MM-DD" query param, falling back if missing or malformed. */
export function parseDateParam(
  dateParam: string | null,
  fallback: string,
): string {
  return dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : fallback;
}

/** Parses an optional "YYYY-MM-DD" query param, returning undefined if missing or malformed. */
export function parseOptionalDateParam(
  dateParam: string | null,
): string | undefined {
  return dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : undefined;
}

const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
];

/** Parses an optional appointment status query param, returning undefined if missing or invalid. */
export function parseStatusParam(
  statusParam: string | null,
): AppointmentStatus | undefined {
  return APPOINTMENT_STATUSES.find((status) => status === statusParam);
}

export function parseViewParam(viewParam: string | null): ViewMode {
  return viewParam === "day" || viewParam === "list" ? viewParam : "week";
}

/** The Monday-first week of seven "YYYY-MM-DD" dates containing the given date. */
export function weekDates(date: string): string[] {
  const [year, month, day] = date.split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = addDays(date, -daysSinceMonday);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
