import type { Schedule } from "@/lib/api/schedules";

/** One row of the time grid represents this many minutes. */
export const SLOT_MINUTES = 30;
/** Pixel height of one 30-minute row. */
export const SLOT_HEIGHT_PX = 28;

/** Fallback business-hours window when no schedule data is available for a date. */
export const DEFAULT_START_HOUR = 8;
export const DEFAULT_END_HOUR = 20;

export interface TimedItem {
  startMinutes: number;
  endMinutes: number;
}

export interface Laned<T> {
  item: T;
  lane: number;
  lanes: number;
}

/**
 * Assigns each item the lowest lane index that doesn't overlap anything
 * already placed, then widens every item's `lanes` to the largest lane
 * used within its own overlap group — so two appointments at the same
 * time end up side-by-side, evenly split, while a lone appointment still
 * gets the full width. Same algorithm the redesign mockup's own
 * `renderVals` validated, just generic over the item type.
 */
export function assignLanes<T extends TimedItem>(items: T[]): Laned<T>[] {
  const sorted = [...items].sort((a, b) => a.startMinutes - b.startMinutes);
  const result: Laned<T>[] = [];

  for (const item of sorted) {
    const clashing = result.filter(
      (r) =>
        r.item.startMinutes < item.endMinutes &&
        r.item.endMinutes > item.startMinutes,
    );
    const used = new Set(clashing.map((r) => r.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    result.push({ item, lane, lanes: 1 });
  }

  for (const entry of result) {
    const group = result.filter(
      (r) =>
        r.item.startMinutes < entry.item.endMinutes &&
        r.item.endMinutes > entry.item.startMinutes,
    );
    entry.lanes = Math.max(...group.map((r) => r.lane)) + 1;
  }

  return result;
}

/** Vertical offset, in px, of a row starting at startMinutes within a grid whose first visible row starts at gridStartMinutes. */
export function topPx(startMinutes: number, gridStartMinutes: number): number {
  return ((startMinutes - gridStartMinutes) / SLOT_MINUTES) * SLOT_HEIGHT_PX;
}

/** Height, in px, of a block spanning [startMinutes, endMinutes) — proportional to duration, so a 60-min block is twice as tall as a 30-min one. A 2px inset keeps adjacent blocks visually separated. */
export function heightPx(startMinutes: number, endMinutes: number): number {
  return ((endMinutes - startMinutes) / SLOT_MINUTES) * SLOT_HEIGHT_PX - 2;
}

/** "HH:MM" wall-clock time to minutes since midnight. */
export function timeToMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Minutes since midnight (wrapped into a single day) to "HH:MM" — the inverse of timeToMinutes. */
export function minutesToTime(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * Minutes since midnight, as seen in timeZone — deliberately the
 * business's own timezone, not the browser's, unlike formatClockTime's
 * plain-text display elsewhere in this app: a spatial grid where an
 * appointment lands in the wrong row is a much more visible (and, for the
 * write path below, actually data-corrupting) problem than a text label
 * reading a few hours off.
 */
export function minutesSinceMidnightInZone(
  isoTimestamp: string,
  timeZone: string,
): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(isoTimestamp));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/** The calendar date ("YYYY-MM-DD") an RFC 3339 timestamp falls on in timeZone — the business's, not the browser's; see minutesSinceMidnightInZone. */
export function dateKeyInZone(isoTimestamp: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(
    new Date(isoTimestamp),
  );
}

/**
 * Converts a wall-clock moment — a "YYYY-MM-DD" date plus minutes since
 * midnight, as they'd read on a clock in timeZone — into the RFC 3339
 * instant that actually is, entirely via Intl.DateTimeFormat (no
 * datetime library, and no assumption that timeZone has a fixed offset,
 * unlike a naive "just subtract 6 hours" shortcut would). Used only for
 * the one place the grid writes a new timestamp back to the API
 * ("Marcar como ocupado"): the mismatch this avoids is exactly the bug
 * the walk-in dialog's own datetime-local field caused earlier — a client
 * silently targeting the wrong instant because it built one in its own
 * timezone instead of the business's.
 *
 * Standard technique: guess the instant naively (as if timeZone were
 * UTC), see what wall-clock time that guess actually displays as in
 * timeZone, and correct by the difference.
 */
export function zonedTimeToISOString(
  dateISO: string,
  minutes: number,
  timeZone: string,
): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const naiveUTC = Date.UTC(year, month - 1, day, hours, mins);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(naiveUTC));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const shownAsUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  const offset = shownAsUTC - naiveUTC;
  return new Date(naiveUTC - offset).toISOString();
}

/** The day of week (0=Sunday..6=Saturday) for a "YYYY-MM-DD" date, computed via UTC components so it never shifts with the browser's own timezone — the same approach calendar.ts's weekDates() uses. */
export function dayOfWeekFor(dateISO: string): number {
  const [year, month, day] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export interface BusinessHours {
  startMinutes: number;
  endMinutes: number;
}

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  startMinutes: DEFAULT_START_HOUR * 60,
  endMinutes: DEFAULT_END_HOUR * 60,
};

/**
 * The open/close window for date, spanning every active schedule row for
 * that day of week (the earliest start to the latest end, so a split
 * shift still shades correctly) — falls back to DEFAULT_START_HOUR..
 * DEFAULT_END_HOUR when there's no schedule data for that day at all.
 */
export function businessHoursForDate(
  schedules: Schedule[],
  dateISO: string,
): BusinessHours {
  const dow = dayOfWeekFor(dateISO);
  const active = schedules.filter((s) => s.day_of_week === dow);
  if (active.length === 0) return DEFAULT_BUSINESS_HOURS;

  const starts = active.map((s) => timeToMinutes(s.start_time));
  const ends = active.map((s) => timeToMinutes(s.end_time));
  return {
    startMinutes: Math.min(...starts),
    endMinutes: Math.max(...ends),
  };
}

/**
 * Whether [startMinutes, endMinutes) fits entirely inside one of
 * employeeId's own active schedule rows for dateISO's day of week (lunch
 * window included, since a walk-in booked over lunch is just as much an
 * hours override as one before opening or after closing) — deliberately
 * stricter than businessHoursForDate's own min-start/max-end union, which
 * exists only for the grid's shading and would wrongly call a day with no
 * schedule rows at all "open" via its DEFAULT_BUSINESS_HOURS fallback.
 * Used only to decide whether to warn before a walk-in booking that's
 * about to override the schedule, mirroring (not duplicating the
 * authority of) the backend's own `workingHoursForSchedules` check —
 * the backend still decides what's actually allowed.
 *
 * Doesn't account for a lunch skip on this specific date
 * (`POST /schedules/lunch-skips`): the rare case where that matters just
 * means an occasional unnecessary warning, not a missed one, which is the
 * safer direction for a warning to be wrong in.
 */
export function isWithinWorkingHours(
  schedules: Schedule[],
  dateISO: string,
  startMinutes: number,
  endMinutes: number,
): boolean {
  const dow = dayOfWeekFor(dateISO);
  const active = schedules.filter((s) => s.day_of_week === dow);
  return active.some(
    (s) =>
      startMinutes >= timeToMinutes(s.start_time) &&
      endMinutes <= timeToMinutes(s.end_time) &&
      !(
        s.lunch_start != null &&
        s.lunch_end != null &&
        startMinutes < timeToMinutes(s.lunch_end) &&
        endMinutes > timeToMinutes(s.lunch_start)
      ),
  );
}

export interface LunchWindow {
  employeeId: string;
  startMinutes: number;
  endMinutes: number;
}

/**
 * The recurring lunch break in effect for dateISO, one per employee who
 * has one configured that day and hasn't skipped it on this exact date
 * (via POST /schedules/lunch-skips). Several employees can each have their
 * own window on the same date, which is why this returns an array rather
 * than a single BusinessHours-shaped value — but at most one window per
 * employee: the backend only ever allows one of an employee's same-day
 * schedule rows to carry a lunch break, so the first match wins if stale
 * data somehow has more than one.
 */
export function lunchWindowsForDate(
  schedules: Schedule[],
  dateISO: string,
  skippedEmployeeIds: ReadonlySet<string>,
): LunchWindow[] {
  const dow = dayOfWeekFor(dateISO);
  const seenEmployeeIds = new Set<string>();
  const windows: LunchWindow[] = [];
  for (const s of schedules) {
    if (
      s.day_of_week !== dow ||
      s.lunch_start == null ||
      s.lunch_end == null ||
      skippedEmployeeIds.has(s.employee_id) ||
      seenEmployeeIds.has(s.employee_id)
    ) {
      continue;
    }
    seenEmployeeIds.add(s.employee_id);
    windows.push({
      employeeId: s.employee_id,
      startMinutes: timeToMinutes(s.lunch_start),
      endMinutes: timeToMinutes(s.lunch_end),
    });
  }
  return windows;
}
