import type { CreateAvailabilityBlockParams } from "@/lib/api/availability-blocks";

export interface AvailabilityFormValues {
  /** <input type="datetime-local"> value, e.g. "2026-09-10T14:00". */
  startTime: string;
  endTime: string;
  reason: string;
}

export const EMPTY_AVAILABILITY_FORM: AvailabilityFormValues = {
  startTime: "",
  endTime: "",
  reason: "",
};

export type AvailabilityFormErrors = Partial<
  Record<keyof AvailabilityFormValues, string>
>;

const defaultT = (key: string): string =>
  ({
    startRequired: "Start is required.",
    endRequired: "End is required.",
    endBeforeStart: "End must be after start.",
  })[key]!;

export function validateAvailabilityForm(
  values: AvailabilityFormValues,
  t: (key: string) => string = defaultT,
): AvailabilityFormErrors {
  const errors: AvailabilityFormErrors = {};

  if (!values.startTime) errors.startTime = t("startRequired");
  if (!values.endTime) errors.endTime = t("endRequired");

  if (values.startTime && values.endTime) {
    const start = new Date(values.startTime);
    const end = new Date(values.endTime);
    if (end.getTime() <= start.getTime()) {
      errors.endTime = t("endBeforeStart");
    }
  }

  return errors;
}

/**
 * Converts validated form values into a create request. Assumes
 * validateAvailabilityForm returned no errors. The datetime-local inputs
 * carry no timezone of their own, so this treats them as the browser's
 * local time — an intentional simplification for the admin dashboard,
 * which assumes the admin operates in the same timezone as their business.
 */
export function buildCreateAvailabilityBlockParams(
  employeeId: string,
  values: AvailabilityFormValues,
): CreateAvailabilityBlockParams {
  const params: CreateAvailabilityBlockParams = {
    employee_id: employeeId,
    start_time: new Date(values.startTime).toISOString(),
    end_time: new Date(values.endTime).toISOString(),
  };

  const reason = values.reason.trim();
  if (reason) params.reason = reason;

  return params;
}
