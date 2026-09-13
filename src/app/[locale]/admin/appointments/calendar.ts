import { addDays } from "@/lib/date";

export type ViewMode = "week" | "day";

export interface CalendarUrlParams {
  view?: ViewMode;
  date?: string;
  employee?: string;
  /** Cancelled appointments are hidden by default on the calendar (week/day) view; only encoded in the URL when explicitly shown. */
  showCancelled?: boolean;
}

/** Builds `/admin/appointments` with only the given, defined query params, in a stable order. */
export function calendarUrl(params: CalendarUrlParams): string {
  const qs = new URLSearchParams();
  if (params.view) qs.set("view", params.view);
  if (params.date) qs.set("date", params.date);
  if (params.employee) qs.set("employee", params.employee);
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

export function parseViewParam(viewParam: string | null): ViewMode {
  return viewParam === "day" ? viewParam : "week";
}

/** The Monday-first week of seven "YYYY-MM-DD" dates containing the given date. */
export function weekDates(date: string): string[] {
  const [year, month, day] = date.split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = addDays(date, -daysSinceMonday);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * The month (and year, when it crosses one) the visible range falls in —
 * otherwise there's no way to tell which month the grid is showing once
 * you've navigated away from today, since the day headers only ever show
 * a weekday and a bare day number. "September 2026" for a range that
 * stays within one month; "August – September 2026" or
 * "December 2026 – January 2027" for a week that spans two. dates must be
 * non-empty and already in chronological order (as weekDates and a single
 * day-view date both are).
 */
export function calendarRangeLabel(dates: string[], locale: string): string {
  const [firstYear, firstMonth] = dates[0].split("-").map(Number);
  const [lastYear, lastMonth] = dates[dates.length - 1].split("-").map(Number);

  // The month name alone, then the year appended by hand ("Septiembre
  // 2026") rather than asking Intl for month+year together: with year
  // included, es-CR's own long-month format inserts "de" ("septiembre de
  // 2026"), which reads fine in a sentence but not as a standalone
  // calendar heading. Capitalized here, per month name, rather than once
  // over the whole label — a two-month range needs both capitalized
  // ("Septiembre – Octubre 2026"), not just the first.
  const format = (year: number, month: number, withYear: boolean) => {
    const raw = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(locale, {
      month: "long",
      timeZone: "UTC",
    });
    const monthName = raw.charAt(0).toLocaleUpperCase(locale) + raw.slice(1);
    return withYear ? `${monthName} ${year}` : monthName;
  };

  return firstYear === lastYear && firstMonth === lastMonth
    ? format(firstYear, firstMonth, true)
    : `${format(firstYear, firstMonth, firstYear !== lastYear)} – ${format(lastYear, lastMonth, true)}`;
}
