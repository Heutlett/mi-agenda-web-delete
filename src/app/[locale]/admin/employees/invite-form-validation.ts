export interface InviteFormValues {
  name: string;
  email: string;
}

export type InviteFormErrors = Partial<Record<keyof InviteFormValues, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Keys match the "Validation" message namespace, shared across the app's forms. */
const defaultT = (key: string): string =>
  ({
    nameRequired: "Name is required.",
    emailRequired: "Email is required.",
    emailInvalid: "Enter a valid email address.",
  })[key]!;

/** Unlike the customer contact form, email is required here: it's how the new employee sets their password. */
export function validateInviteForm(
  values: InviteFormValues,
  t: (key: string) => string = defaultT,
): InviteFormErrors {
  const errors: InviteFormErrors = {};

  if (!values.name.trim()) errors.name = t("nameRequired");

  const email = values.email.trim();
  if (!email) {
    errors.email = t("emailRequired");
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = t("emailInvalid");
  }

  return errors;
}
