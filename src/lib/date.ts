/** Today's calendar date (YYYY-MM-DD) as seen in the given IANA timezone. */
export function todayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
    new Date(),
  );
}

/** Formats year/month/day components as zero-padded "YYYY-MM-DD". */
export function formatIsoDate(
  year: number,
  month: number,
  day: number,
): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

/**
 * Maps an app locale code (as used in routing and messages, e.g. "es") to
 * the IETF tag `Intl` formatters expect. Costa Rica is the initial market,
 * so Spanish defaults to its conventions specifically rather than a
 * generic "es".
 */
const INTL_LOCALES: Record<string, string> = {
  es: "es-CR",
  en: "en-US",
};

export function toIntlLocale(locale: string): string {
  return INTL_LOCALES[locale] ?? locale;
}

/** Formats a "YYYY-MM-DD" date as e.g. "Thu, Sep 10" ("jue, 10 sep" in Spanish). */
export function formatDate(date: string, locale = "en-US"): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Formats a "YYYY-MM-DD" date in full, e.g. "Tuesday, September 8, 2026"
 * ("martes 8 de septiembre 2026" in Spanish). Spanish drops the comma
 * after the weekday and joins day/month with "de" instead, which the
 * locale's own toLocaleDateString doesn't produce on its own.
 */
export function formatFullDate(date: string, locale = "en-US"): string {
  const [year, month, day] = date.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  const weekday = d.toLocaleDateString(locale, {
    weekday: "long",
    timeZone: "UTC",
  });
  const monthName = d.toLocaleDateString(locale, {
    month: "long",
    timeZone: "UTC",
  });

  return locale.startsWith("es")
    ? `${weekday} ${day} de ${monthName} ${year}`
    : `${weekday}, ${monthName} ${day}, ${year}`;
}

/** Adds (or subtracts, given a negative `days`) calendar days to a "YYYY-MM-DD" date. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return formatIsoDate(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
  );
}

// Some ICU versions put a no-break space (0x00A0) or narrow no-break space
// (0x202F) before AM/PM instead of a plain space (0x20); built from char
// codes, not literal characters, so there's no ambiguity about what's here.
export const NON_BREAKING_SPACES = new RegExp(
  `[${String.fromCharCode(0x00a0)}${String.fromCharCode(0x202f)}]`,
  "g",
);

/** Formats an RFC 3339 timestamp in the browser's local time, e.g. "Sep 10, 2026, 2:00 PM". */
export function formatDateTime(isoTimestamp: string, locale = "en-US"): string {
  const formatted = new Date(isoTimestamp).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return formatted.replace(NON_BREAKING_SPACES, " ");
}

/** Formats an RFC 3339 timestamp's time of day in the browser's local time, e.g. "2:00 PM". */
export function formatClockTime(isoTimestamp: string, locale = "en-US"): string {
  const formatted = new Date(isoTimestamp).toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
  return formatted.replace(NON_BREAKING_SPACES, " ");
}

/** The calendar date ("YYYY-MM-DD") an RFC 3339 timestamp falls on in the browser's local timezone. */
export function localDateKey(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date(isoTimestamp));
}
