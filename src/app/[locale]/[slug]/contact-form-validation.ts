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
  })[key]!;

/** Name and phone are both required. */
export function validateContactForm(
  values: ContactFormValues,
  t: (key: string) => string = defaultT,
): ContactFormErrors {
  const errors: ContactFormErrors = {};

  if (!values.name.trim()) errors.name = t("nameRequired");
  if (!values.phone.trim()) errors.phone = t("phoneRequired");

  return errors;
}
