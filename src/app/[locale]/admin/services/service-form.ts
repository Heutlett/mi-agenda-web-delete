import type {
  CreateServiceParams,
  Service,
  UpdateServiceParams,
} from "@/lib/api/services";

export interface ServiceFormValues {
  name: string;
  description: string;
  durationMinutes: string;
  price: string;
}

export const EMPTY_SERVICE_FORM: ServiceFormValues = {
  name: "",
  description: "",
  durationMinutes: "",
  price: "",
};

export function serviceToFormValues(service: Service): ServiceFormValues {
  return {
    name: service.name,
    description: service.description ?? "",
    durationMinutes: String(service.duration_minutes),
    price: String(service.price),
  };
}

export type ServiceFormErrors = Partial<
  Record<keyof ServiceFormValues, string>
>;

const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;

export const MIN_DURATION_MINUTES = 15;
export const MAX_DURATION_MINUTES = 480;
export const DURATION_STEP_MINUTES = 15;

type Translator = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

const DEFAULT_DURATION_HINT = `${MIN_DURATION_MINUTES}-${MAX_DURATION_MINUTES} minutes, in ${DURATION_STEP_MINUTES}-minute increments`;

/** Falls back to English so existing tests and non-React callers work without a translator. */
const defaultT: Translator = (key) =>
  (
    ({
      durationHint: DEFAULT_DURATION_HINT,
      nameRequired: "Name is required.",
      durationRequired: "Duration is required.",
      durationInvalid: `Enter a duration of ${DEFAULT_DURATION_HINT}.`,
      priceRequired: "Price is required.",
      priceInvalid: "Enter a valid price, e.g. 25.00.",
    }) as Record<string, string>
  )[key]!;

/** The duration hint shown alongside the field, e.g. "15-480 minutes, in 15-minute increments". */
export function durationHint(t: Translator = defaultT): string {
  return t("durationHint", {
    min: MIN_DURATION_MINUTES,
    max: MAX_DURATION_MINUTES,
    step: DURATION_STEP_MINUTES,
  });
}

export const DURATION_HINT = durationHint();

function isValidDuration(minutes: number): boolean {
  return (
    minutes >= MIN_DURATION_MINUTES &&
    minutes <= MAX_DURATION_MINUTES &&
    minutes % DURATION_STEP_MINUTES === 0
  );
}

export function validateServiceForm(
  values: ServiceFormValues,
  t: Translator = defaultT,
): ServiceFormErrors {
  const errors: ServiceFormErrors = {};

  if (!values.name.trim()) errors.name = t("nameRequired");

  const duration = values.durationMinutes.trim();
  if (!duration) {
    errors.durationMinutes = t("durationRequired");
  } else if (!/^\d+$/.test(duration) || !isValidDuration(Number(duration))) {
    errors.durationMinutes = t("durationInvalid", {
      hint: durationHint(t),
    });
  }

  const price = values.price.trim();
  if (!price) {
    errors.price = t("priceRequired");
  } else if (!PRICE_PATTERN.test(price)) {
    errors.price = t("priceInvalid");
  }

  return errors;
}

/** Converts validated form values into a create request. Assumes validateServiceForm returned no errors. */
export function buildCreateServiceParams(
  values: ServiceFormValues,
): CreateServiceParams {
  const params: CreateServiceParams = {
    name: values.name.trim(),
    duration_minutes: Number(values.durationMinutes.trim()),
    price: values.price.trim(),
  };

  const description = values.description.trim();
  if (description) params.description = description;

  return params;
}

/**
 * Diffs the form against the originally loaded service and returns only
 * the changed fields, ready to PATCH. Never includes an empty string for
 * description/price: the API has no way to clear those back to null via
 * this endpoint, so leaving a blanked-out field out of the patch —
 * unchanged on the server — is the only safe behavior, same as business
 * settings.
 */
export function buildServicePatch(
  values: ServiceFormValues,
  original: Service,
): UpdateServiceParams {
  const patch: UpdateServiceParams = {};

  const name = values.name.trim();
  if (name && name !== original.name) patch.name = name;

  const description = values.description.trim();
  if (description && description !== (original.description ?? "")) {
    patch.description = description;
  }

  const duration = values.durationMinutes.trim();
  if (duration) {
    const durationNumber = Number(duration);
    if (durationNumber !== original.duration_minutes) {
      patch.duration_minutes = durationNumber;
    }
  }

  const price = values.price.trim();
  if (price && price !== String(original.price)) patch.price = price;

  return patch;
}
