import {
  formatDate,
  formatIsoDate,
  todayInTimezone,
  toIntlLocale,
} from "@/lib/date";

export { formatDate, todayInTimezone, toIntlLocale };

export interface YearMonth {
  year: number;
  month: number; // 1-12
}

/** Parses a "YYYY-MM" query param, falling back to the given date's year/month if missing or invalid. */
export function parseMonthParam(
  monthParam: string | undefined,
  fallbackIso: string,
): YearMonth {
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [year, month] = monthParam.split("-").map(Number);
    if (month >= 1 && month <= 12) return { year, month };
  }
  const [year, month] = fallbackIso.split("-").map(Number);
  return { year, month };
}

export function formatMonthParam({ year, month }: YearMonth): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}`;
}

export function shiftMonth(
  { year, month }: YearMonth,
  delta: number,
): YearMonth {
  const total = year * 12 + (month - 1) + delta;
  return {
    year: Math.floor(total / 12),
    month: (((total % 12) + 12) % 12) + 1,
  };
}

/**
 * A Monday-first grid of weeks for the given month, each cell either an ISO
 * date string or null for the leading/trailing padding outside the month.
 */
export function buildMonthGrid({
  year,
  month,
}: YearMonth): (string | null)[][] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingBlanks = (firstOfMonth.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6

  const cells: (string | null)[] = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      formatIsoDate(year, month, i + 1),
    ),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function monthLabel({ year, month }: YearMonth, locale = "en-US"): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Localized short weekday labels (Monday first), e.g. ["Mon", ..., "Sun"] or
 * ["lun", ..., "dom"]. Derived from `Intl` rather than translation strings
 * since weekday names are locale calendar data, not app copy.
 */
export function weekdayLabels(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  });
  // 2024-01-01 was a Monday (UTC).
  return Array.from({ length: 7 }, (_, i) =>
    formatter.format(new Date(Date.UTC(2024, 0, 1 + i))),
  );
}
