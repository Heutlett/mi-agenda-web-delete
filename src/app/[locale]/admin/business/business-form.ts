import type { Business, UpdateBusinessParams } from "@/lib/api/business";

export interface BusinessFormValues {
  name: string;
  slug: string;
  phone: string;
  email: string;
  address: string;
  timezone: string;
  status: "active" | "inactive";
  maxAppointmentsPerCustomerPerDay: string;
  maxAppointmentsPerCustomerPerWeek: string;
  currencySymbol: string;
  language: string;
}

export function businessToFormValues(business: Business): BusinessFormValues {
  return {
    name: business.name,
    slug: business.slug,
    phone: business.phone,
    email: business.email ?? "",
    address: business.address ?? "",
    timezone: business.timezone,
    status: business.status,
    maxAppointmentsPerCustomerPerDay: String(
      business.max_appointments_per_customer_per_day,
    ),
    maxAppointmentsPerCustomerPerWeek: String(
      business.max_appointments_per_customer_per_week,
    ),
    currencySymbol: business.currency_symbol,
    language: business.language,
  };
}

export type BusinessFormErrors = Partial<
  Record<keyof BusinessFormValues, string>
>;

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Falls back to English so existing tests can call validateBusinessForm without a translator. */
const defaultT = (key: string): string =>
  ({
    nameRequired: "Name is required.",
    slugRequired: "Slug is required.",
    slugInvalid: "Use lowercase letters, numbers, and single hyphens only.",
    phoneRequired: "Phone is required.",
    timezoneRequired: "Timezone is required.",
    maxAppointmentsPerDayInvalid: "Enter a whole number of 1 or more.",
    maxAppointmentsPerWeekInvalid: "Enter a whole number of 1 or more.",
    currencySymbolRequired: "Currency symbol is required.",
  })[key]!;

function isPositiveInteger(value: string): boolean {
  return /^[1-9][0-9]*$/.test(value.trim());
}

export function validateBusinessForm(
  values: BusinessFormValues,
  t: (key: string) => string = defaultT,
): BusinessFormErrors {
  const errors: BusinessFormErrors = {};

  if (!values.name.trim()) errors.name = t("nameRequired");

  const slug = values.slug.trim();
  if (!slug) {
    errors.slug = t("slugRequired");
  } else if (!SLUG_PATTERN.test(slug)) {
    errors.slug = t("slugInvalid");
  }

  if (!values.phone.trim()) errors.phone = t("phoneRequired");

  if (!values.timezone.trim()) errors.timezone = t("timezoneRequired");

  if (!isPositiveInteger(values.maxAppointmentsPerCustomerPerDay)) {
    errors.maxAppointmentsPerCustomerPerDay = t(
      "maxAppointmentsPerDayInvalid",
    );
  }
  if (!isPositiveInteger(values.maxAppointmentsPerCustomerPerWeek)) {
    errors.maxAppointmentsPerCustomerPerWeek = t(
      "maxAppointmentsPerWeekInvalid",
    );
  }

  if (!values.currencySymbol.trim()) {
    errors.currencySymbol = t("currencySymbolRequired");
  }

  return errors;
}

/**
 * Diffs the form against the originally loaded business and returns only
 * the changed fields, ready to PATCH. Never includes an empty string for
 * email/address: the API has no way to clear those back to null via this
 * endpoint (an empty string is stored literally, not treated as "clear"),
 * so leaving a blanked-out field out of the patch — unchanged on the
 * server — is the only safe behavior until that gap is fixed API-side.
 * phone can't be blanked at all — validateBusinessForm already blocks
 * submitting an empty one, since the API rejects it outright.
 */
export function buildBusinessPatch(
  values: BusinessFormValues,
  original: Business,
): UpdateBusinessParams {
  const patch: UpdateBusinessParams = {};

  const name = values.name.trim();
  if (name && name !== original.name) patch.name = name;

  const slug = values.slug.trim();
  if (slug && slug !== original.slug) patch.slug = slug;

  const timezone = values.timezone.trim();
  if (timezone && timezone !== original.timezone) patch.timezone = timezone;

  if (values.status !== original.status) patch.status = values.status;

  const phone = values.phone.trim();
  if (phone && phone !== original.phone) patch.phone = phone;

  const email = values.email.trim();
  if (email && email !== (original.email ?? "")) patch.email = email;

  const address = values.address.trim();
  if (address && address !== (original.address ?? "")) patch.address = address;

  const maxPerDay = Number(values.maxAppointmentsPerCustomerPerDay);
  if (maxPerDay !== original.max_appointments_per_customer_per_day) {
    patch.max_appointments_per_customer_per_day = maxPerDay;
  }

  const maxPerWeek = Number(values.maxAppointmentsPerCustomerPerWeek);
  if (maxPerWeek !== original.max_appointments_per_customer_per_week) {
    patch.max_appointments_per_customer_per_week = maxPerWeek;
  }

  const currencySymbol = values.currencySymbol.trim();
  if (currencySymbol && currencySymbol !== original.currency_symbol) {
    patch.currency_symbol = currencySymbol;
  }

  if (values.language !== original.language) patch.language = values.language;

  return patch;
}
