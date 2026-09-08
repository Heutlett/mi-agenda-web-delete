import { NON_BREAKING_SPACES } from "./date";

/** Formats a duration in minutes as e.g. "30min", "1h", "1h 30min". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) return `${remainder}min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}min`;
}

/** The platform's default currency symbol (colones), matching the backend's own default for a new business. Used only as a fallback while a business's real setting hasn't loaded yet. */
export const DEFAULT_CURRENCY_SYMBOL = "₡";

/**
 * Formats a price with its business's currency symbol to two decimals,
 * e.g. "₡25.00", or null when there's no price to show.
 */
export function formatPrice(
  price: number | null,
  currencySymbol: string,
): string | null {
  if (price === null) return null;
  return `${currencySymbol}${price.toFixed(2)}`;
}

/** Formats an RFC 3339 timestamp as a 12-hour clock time in the given IANA timezone, e.g. "9:00 AM". */
export function formatTime(
  isoTimestamp: string,
  timezone: string,
  locale = "en-US",
): string {
  const formatted = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoTimestamp));
  return formatted.replace(NON_BREAKING_SPACES, " ");
}
