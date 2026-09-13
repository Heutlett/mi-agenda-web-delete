/**
 * All customers are Costa Rican for now, so the country code is fixed
 * rather than asking for it — see design.md, the initial target market.
 */
export const COUNTRY_CODE = "506";

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Normalizes a customer-entered phone to always carry exactly one leading
 * country code, so "88393511", "50688393511", and "+506 8839-3511" all
 * become the same value — matching what the backend's own phone.Normalize
 * does server-side. Without this, a customer who pastes their number with
 * the country code already on it would get it prepended a second time.
 */
export function normalizePhone(raw: string): string {
  const digits = digitsOnly(raw);
  return digits.startsWith(COUNTRY_CODE) ? digits : `${COUNTRY_CODE}${digits}`;
}

/** How many digits follow the country code in a valid Costa Rica number — SUTEL's flat national numbering plan has no area codes, so every valid number is exactly this long. */
const LOCAL_NUMBER_LENGTH = 8;

/** The only digits a Costa Rica local number may start with: 2 (landline), 4 (VoIP), 6/7/8 (mobile) — matches the backend's own internal/phone.IsValidCostaRica exactly. */
const VALID_LEADING_DIGITS = new Set(["2", "4", "6", "7", "8"]);

/**
 * Reports whether a normalized phone (see normalizePhone) has the shape of
 * a real, assignable Costa Rica number. A format check only — no proof the
 * customer actually holds the number — mirrored purely for instant client-
 * side feedback; the backend re-validates authoritatively at booking time.
 */
export function isValidCostaRicaPhone(normalized: string): boolean {
  if (!normalized.startsWith(COUNTRY_CODE)) return false;
  const local = normalized.slice(COUNTRY_CODE.length);
  if (local.length !== LOCAL_NUMBER_LENGTH) return false;
  if (!VALID_LEADING_DIGITS.has(local[0])) return false;
  return !allSameDigit(local);
}

/** Every character is the same digit, e.g. "88888888" — a real leading digit and the right length, but the single most common lazy fake-number pattern. */
function allSameDigit(s: string): boolean {
  return s.split("").every((c) => c === s[0]);
}
