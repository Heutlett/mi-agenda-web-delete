import type {
  CreateScheduleParams,
  Schedule,
  UpdateScheduleParams,
} from "@/lib/api/schedules";

/**
 * Localized weekday names (Sunday first, matching `day_of_week`'s 0-6
 * indexing), derived from `Intl` rather than translation strings since
 * these are locale calendar data, not app copy.
 */
export function dayNames(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  });
  // 2023-12-31 was a Sunday (UTC).
  return Array.from({ length: 7 }, (_, i) =>
    formatter.format(new Date(Date.UTC(2023, 11, 31 + i))),
  );
}

export interface ScheduleFormValues {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}

export const EMPTY_SCHEDULE_FORM: ScheduleFormValues = {
  dayOfWeek: "1",
  startTime: "",
  endTime: "",
};

export function scheduleToFormValues(schedule: Schedule): ScheduleFormValues {
  return {
    dayOfWeek: String(schedule.day_of_week),
    startTime: schedule.start_time,
    endTime: schedule.end_time,
  };
}

export type ScheduleFormErrors = Partial<
  Record<keyof ScheduleFormValues, string>
>;

function timeToMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

const defaultT = (key: string): string =>
  ({
    startRequired: "Start time is required.",
    endRequired: "End time is required.",
    endBeforeStart: "End time must be after start time.",
  })[key]!;

export function validateScheduleForm(
  values: ScheduleFormValues,
  t: (key: string) => string = defaultT,
): ScheduleFormErrors {
  const errors: ScheduleFormErrors = {};

  if (!values.startTime) errors.startTime = t("startRequired");
  if (!values.endTime) errors.endTime = t("endRequired");

  const start = timeToMinutes(values.startTime);
  const end = timeToMinutes(values.endTime);
  if (start != null && end != null && end <= start) {
    errors.endTime = t("endBeforeStart");
  }

  return errors;
}

/** Converts validated form values into a create request. Assumes validateScheduleForm returned no errors. */
export function buildCreateScheduleParams(
  employeeId: string,
  values: ScheduleFormValues,
): CreateScheduleParams {
  return {
    employee_id: employeeId,
    day_of_week: Number(values.dayOfWeek),
    start_time: values.startTime,
    end_time: values.endTime,
  };
}

/** Diffs the form against the originally loaded schedule and returns only the changed fields, ready to PATCH. */
export function buildSchedulePatch(
  values: ScheduleFormValues,
  original: Schedule,
): UpdateScheduleParams {
  const patch: UpdateScheduleParams = {};

  const dayOfWeek = Number(values.dayOfWeek);
  if (dayOfWeek !== original.day_of_week) patch.day_of_week = dayOfWeek;

  if (values.startTime && values.startTime !== original.start_time) {
    patch.start_time = values.startTime;
  }

  if (values.endTime && values.endTime !== original.end_time) {
    patch.end_time = values.endTime;
  }

  return patch;
}
