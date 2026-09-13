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
  /** Empty string means no lunch break — must be empty together with lunchEnd, or both set. */
  lunchStart: string;
  lunchEnd: string;
}

export const EMPTY_SCHEDULE_FORM: ScheduleFormValues = {
  dayOfWeek: "1",
  startTime: "",
  endTime: "",
  lunchStart: "",
  lunchEnd: "",
};

export function scheduleToFormValues(schedule: Schedule): ScheduleFormValues {
  return {
    dayOfWeek: String(schedule.day_of_week),
    startTime: schedule.start_time,
    endTime: schedule.end_time,
    lunchStart: schedule.lunch_start ?? "",
    lunchEnd: schedule.lunch_end ?? "",
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
    lunchBothRequired: "Enter both a lunch start and end time, or leave both blank.",
    lunchEndBeforeStart: "Lunch end time must be after lunch start time.",
    lunchOutsideHours: "Lunch must fall within the start and end time.",
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

  if (Boolean(values.lunchStart) !== Boolean(values.lunchEnd)) {
    errors.lunchEnd = t("lunchBothRequired");
  } else if (values.lunchStart && values.lunchEnd) {
    const lunchStart = timeToMinutes(values.lunchStart);
    const lunchEnd = timeToMinutes(values.lunchEnd);
    if (lunchStart != null && lunchEnd != null) {
      if (lunchEnd <= lunchStart) {
        errors.lunchEnd = t("lunchEndBeforeStart");
      } else if (
        start != null &&
        end != null &&
        (lunchStart < start || lunchEnd > end)
      ) {
        errors.lunchEnd = t("lunchOutsideHours");
      }
    }
  }

  return errors;
}

/** Converts validated form values into a create request. Assumes validateScheduleForm returned no errors. */
export function buildCreateScheduleParams(
  employeeId: string,
  values: ScheduleFormValues,
): CreateScheduleParams {
  const params: CreateScheduleParams = {
    employee_id: employeeId,
    day_of_week: Number(values.dayOfWeek),
    start_time: values.startTime,
    end_time: values.endTime,
  };

  if (values.lunchStart && values.lunchEnd) {
    params.lunch_start = values.lunchStart;
    params.lunch_end = values.lunchEnd;
  }

  return params;
}

/**
 * mi-agenda-api returns these two cross-schedule validation failures as raw
 * English text (see `errScheduleOverlap`/`errMultipleLunchBreaks` in
 * `internal/modules/schedule/schedule.go`), since only the two schedules
 * being compared live server-side — the form can't pre-validate them the
 * way it does the single-schedule checks above. Match them by their exact
 * known text and translate; anything else (an unexpected/internal error)
 * passes through unchanged.
 */
const API_ERROR_KEYS: Record<string, string> = {
  "this range overlaps another schedule already set for this day": "overlapError",
  "only one schedule range per day can have a lunch break": "multipleLunchError",
};

export interface ScheduleApiErrorDisplay {
  text: string;
  /** True for a known, translated business-rule rejection; false for an unrecognized/unexpected error, which keeps its original destructive styling. */
  isBusinessRuleError: boolean;
}

export function translateScheduleApiError(
  message: string,
  t: (key: string) => string,
): ScheduleApiErrorDisplay {
  const key = API_ERROR_KEYS[message];
  return key
    ? { text: t(key), isBusinessRuleError: true }
    : { text: message, isBusinessRuleError: false };
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

  const hadLunch = original.lunch_start != null && original.lunch_end != null;
  const hasLunch = Boolean(values.lunchStart) && Boolean(values.lunchEnd);

  if (hasLunch) {
    if (
      values.lunchStart !== (original.lunch_start ?? "") ||
      values.lunchEnd !== (original.lunch_end ?? "")
    ) {
      patch.lunch_start = values.lunchStart;
      patch.lunch_end = values.lunchEnd;
    }
  } else if (hadLunch) {
    // Both lunch fields were cleared: remove_lunch is the only way to null
    // the columns back out, since a plain field update can only ever set
    // a value.
    patch.remove_lunch = true;
  }

  return patch;
}
