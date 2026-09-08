export interface TimezoneOption {
  value: string;
  label: string;
}

/**
 * A curated shortlist rather than every IANA timezone: this platform's
 * businesses are expected to cluster around Costa Rica and nearby markets
 * for now. Extend this list as the platform reaches new markets. Labels
 * come from the "Timezones" message namespace, keyed by the same order, so
 * they can be localized.
 */
export const TIMEZONE_VALUES = [
  "America/Costa_Rica",
  "America/Guatemala",
  "America/El_Salvador",
  "America/Tegucigalpa",
  "America/Managua",
  "America/Panama",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
] as const;

const TIMEZONE_KEYS: Record<(typeof TIMEZONE_VALUES)[number], string> = {
  "America/Costa_Rica": "costaRica",
  "America/Guatemala": "guatemala",
  "America/El_Salvador": "elSalvador",
  "America/Tegucigalpa": "honduras",
  "America/Managua": "nicaragua",
  "America/Panama": "panama",
  "America/Mexico_City": "mexicoCity",
  "America/Bogota": "colombia",
  "America/Lima": "peru",
  "America/Santiago": "chile",
  "America/New_York": "usEastern",
  "America/Chicago": "usCentral",
  "America/Denver": "usMountain",
  "America/Los_Angeles": "usPacific",
};

export const DEFAULT_TIMEZONE = "America/Costa_Rica";

/** Builds the localized timezone option list using the given translator (from the "Timezones" namespace). */
export function timezoneOptions(t: (key: string) => string): TimezoneOption[] {
  return TIMEZONE_VALUES.map((value) => ({
    value,
    label: t(TIMEZONE_KEYS[value]),
  }));
}

/**
 * Ensures `current` has a matching option, even when it isn't in the
 * curated shortlist — a business set up with some other IANA timezone (via
 * the API directly, or before this list existed) still needs to keep its
 * actual value selected, not silently switch to whatever renders first.
 */
export function withCurrentTimezone(
  current: string,
  options: TimezoneOption[],
): TimezoneOption[] {
  if (options.some((option) => option.value === current)) return options;
  return [{ value: current, label: current }, ...options];
}
