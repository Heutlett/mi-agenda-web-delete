import { addDays, formatIsoDate } from "@/lib/date";

export type Period = "day" | "week" | "month" | "custom";

/**
 * The inclusive "YYYY-MM-DD" [start, end] range for period, anchored on
 * today (also "YYYY-MM-DD", in the business's own timezone). Week is
 * Monday-Sunday, the same week definition the per-customer booking limits
 * already use server-side. "custom" has no computable range of its own —
 * the caller supplies its own picked dates instead of using this function
 * — so it falls back to just today, never reached in practice.
 */
export function periodRange(
  period: Period,
  today: string,
): { start: string; end: string } {
  if (period === "day" || period === "custom") {
    return { start: today, end: today };
  }

  const [year, month, day] = today.split("-").map(Number);

  if (period === "week") {
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const start = addDays(today, -daysSinceMonday);
    return { start, end: addDays(start, 6) };
  }

  const start = formatIsoDate(year, month, 1);
  // Day 0 of next month is the last day of this month.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start, end: formatIsoDate(year, month, daysInMonth) };
}
