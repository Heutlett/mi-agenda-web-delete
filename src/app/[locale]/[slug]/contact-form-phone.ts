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
