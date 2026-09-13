import type { AvailabilityBlock } from "@/lib/api/availability-blocks";
import {
  dateKeyInZone,
  minutesSinceMidnightInZone,
  minutesToTime,
  SLOT_MINUTES,
  timeToMinutes,
  zonedTimeToISOString,
} from "./calendar-grid";

export interface BlockFormValues {
  /** "YYYY-MM-DD". */
  date: string;
  /** "HH:MM" wall-clock time, in the business's own timezone. */
  startTime: string;
  endTime: string;
  reason: string;
}

/** Defaults for a new block: the clicked slot's own 30 minutes, with a locale-appropriate default description the user can still edit or clear. */
export function defaultBlockForm(
  date: string,
  startMinutes: number,
  defaultReason: string,
): BlockFormValues {
  return {
    date,
    startTime: minutesToTime(startMinutes),
    endTime: minutesToTime(startMinutes + SLOT_MINUTES),
    reason: defaultReason,
  };
}

/** Maps an existing block to form values, converting its instants to wall-clock date/time in the business's own timezone. */
export function blockToFormValues(
  block: AvailabilityBlock,
  timeZone: string,
): BlockFormValues {
  return {
    date: dateKeyInZone(block.start_time, timeZone),
    startTime: minutesToTime(
      minutesSinceMidnightInZone(block.start_time, timeZone),
    ),
    endTime: minutesToTime(minutesSinceMidnightInZone(block.end_time, timeZone)),
    reason: block.reason ?? "",
  };
}

export type BlockFormErrors = Partial<
  Record<"date" | "startTime" | "endTime", string>
>;

const defaultT = (key: string): string =>
  ({
    blockDateRequired: "Date is required.",
    blockStartRequired: "Start is required.",
    blockEndRequired: "End is required.",
    blockEndBeforeStart: "End must be after start.",
  })[key]!;

export function validateBlockForm(
  values: BlockFormValues,
  t: (key: string) => string = defaultT,
): BlockFormErrors {
  const errors: BlockFormErrors = {};

  if (!values.date) errors.date = t("blockDateRequired");
  if (!values.startTime) errors.startTime = t("blockStartRequired");
  if (!values.endTime) errors.endTime = t("blockEndRequired");

  if (
    values.startTime &&
    values.endTime &&
    timeToMinutes(values.endTime) <= timeToMinutes(values.startTime)
  ) {
    errors.endTime = t("blockEndBeforeStart");
  }

  return errors;
}

/** Converts validated form values (assumes validateBlockForm returned no errors) into the RFC 3339 instants the API expects, computed in the business's own timezone rather than the browser's. */
export function buildBlockTimeRange(
  values: BlockFormValues,
  timeZone: string,
): { startISO: string; endISO: string } {
  return {
    startISO: zonedTimeToISOString(
      values.date,
      timeToMinutes(values.startTime),
      timeZone,
    ),
    endISO: zonedTimeToISOString(
      values.date,
      timeToMinutes(values.endTime),
      timeZone,
    ),
  };
}
