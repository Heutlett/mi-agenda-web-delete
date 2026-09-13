import { isValidCostaRicaPhone, normalizePhone } from "./contact-form-phone";

export interface ContactFormValues {
  name: string;
  phone: string;
}

export type ContactFormErrors = Partial<
  Record<keyof ContactFormValues, string>
>;

/** Keys match the "Validation" message namespace, shared across the app's forms. */
const defaultT = (key: string): string =>
  ({
    nameRequired: "Name is required.",
    phoneRequired: "Phone is required.",
    phoneInvalid: "Enter a valid Costa Rica phone number.",
  })[key]!;

/**
 * Name and phone are both required; phone must also look like a real Costa
 * Rica number (see isValidCostaRicaPhone) — instant client-side feedback
 * only, the backend re-validates authoritatively at booking time.
 */
export function validateContactForm(
  values: ContactFormValues,
  t: (key: string) => string = defaultT,
): ContactFormErrors {
  const errors: ContactFormErrors = {};

  if (!values.name.trim()) errors.name = t("nameRequired");

  if (!values.phone.trim()) {
    errors.phone = t("phoneRequired");
  } else if (!isValidCostaRicaPhone(normalizePhone(values.phone))) {
    errors.phone = t("phoneInvalid");
  }

  return errors;
}
