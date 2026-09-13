import { describe, expect, it } from "vitest";
import type { Schedule } from "@/lib/api/schedules";
import {
  buildCreateScheduleParams,
  buildSchedulePatch,
  scheduleToFormValues,
  translateScheduleApiError,
  validateScheduleForm,
} from "./schedule-form";

const schedule: Schedule = {
  id: "sc1",
  employee_id: "e1",
  day_of_week: 1,
  start_time: "09:00",
  end_time: "17:00",
  lunch_start: null,
  lunch_end: null,
};

const scheduleWithLunch: Schedule = {
  ...schedule,
  lunch_start: "12:00",
  lunch_end: "13:00",
};

describe("scheduleToFormValues", () => {
  it("maps a schedule to form values", () => {
    expect(scheduleToFormValues(schedule)).toEqual({
      dayOfWeek: "1",
      startTime: "09:00",
      endTime: "17:00",
      lunchStart: "",
      lunchEnd: "",
    });
  });

  it("maps a schedule with a lunch window", () => {
    expect(scheduleToFormValues(scheduleWithLunch)).toEqual({
      dayOfWeek: "1",
      startTime: "09:00",
      endTime: "17:00",
      lunchStart: "12:00",
      lunchEnd: "13:00",
    });
  });
});

describe("validateScheduleForm", () => {
  it("requires start and end time", () => {
    const errors = validateScheduleForm({
      dayOfWeek: "1",
      startTime: "",
      endTime: "",
      lunchStart: "",
      lunchEnd: "",
    });
    expect(errors.startTime).toBeDefined();
    expect(errors.endTime).toBeDefined();
  });

  it("rejects an end time before or equal to the start time", () => {
    expect(
      validateScheduleForm({
        dayOfWeek: "1",
        startTime: "17:00",
        endTime: "09:00",
        lunchStart: "",
        lunchEnd: "",
      }).endTime,
    ).toBeDefined();
    expect(
      validateScheduleForm({
        dayOfWeek: "1",
        startTime: "09:00",
        endTime: "09:00",
        lunchStart: "",
        lunchEnd: "",
      }).endTime,
    ).toBeDefined();
  });

  it("passes for a valid range with no lunch", () => {
    expect(
      validateScheduleForm({
        dayOfWeek: "1",
        startTime: "09:00",
        endTime: "17:00",
        lunchStart: "",
        lunchEnd: "",
      }),
    ).toEqual({});
  });

  it("passes for a valid lunch window within hours", () => {
    expect(
      validateScheduleForm({
        dayOfWeek: "1",
        startTime: "09:00",
        endTime: "17:00",
        lunchStart: "12:00",
        lunchEnd: "13:00",
      }),
    ).toEqual({});
  });

  it("rejects lunch_start given without lunch_end", () => {
    expect(
      validateScheduleForm({
        dayOfWeek: "1",
        startTime: "09:00",
        endTime: "17:00",
        lunchStart: "12:00",
        lunchEnd: "",
      }).lunchEnd,
    ).toBeDefined();
  });

  it("rejects lunch end before or equal to lunch start", () => {
    expect(
      validateScheduleForm({
        dayOfWeek: "1",
        startTime: "09:00",
        endTime: "17:00",
        lunchStart: "13:00",
        lunchEnd: "12:00",
      }).lunchEnd,
    ).toBeDefined();
  });

  it("rejects lunch outside the start/end range", () => {
    expect(
      validateScheduleForm({
        dayOfWeek: "1",
        startTime: "09:00",
        endTime: "17:00",
        lunchStart: "17:30",
        lunchEnd: "18:00",
      }).lunchEnd,
    ).toBeDefined();
  });
});

describe("buildCreateScheduleParams", () => {
  it("builds the create request", () => {
    expect(
      buildCreateScheduleParams("e1", {
        dayOfWeek: "2",
        startTime: "09:00",
        endTime: "17:00",
        lunchStart: "",
        lunchEnd: "",
      }),
    ).toEqual({
      employee_id: "e1",
      day_of_week: 2,
      start_time: "09:00",
      end_time: "17:00",
    });
  });

  it("includes a lunch window when both fields are given", () => {
    expect(
      buildCreateScheduleParams("e1", {
        dayOfWeek: "2",
        startTime: "09:00",
        endTime: "17:00",
        lunchStart: "12:00",
        lunchEnd: "13:00",
      }),
    ).toEqual({
      employee_id: "e1",
      day_of_week: 2,
      start_time: "09:00",
      end_time: "17:00",
      lunch_start: "12:00",
      lunch_end: "13:00",
    });
  });
});

describe("buildSchedulePatch", () => {
  it("returns an empty patch when nothing changed", () => {
    expect(
      buildSchedulePatch(scheduleToFormValues(schedule), schedule),
    ).toEqual({});
  });

  it("includes only the changed fields", () => {
    const values = scheduleToFormValues(schedule);
    values.endTime = "18:00";
    expect(buildSchedulePatch(values, schedule)).toEqual({
      end_time: "18:00",
    });
  });

  it("includes a changed day of week", () => {
    const values = scheduleToFormValues(schedule);
    values.dayOfWeek = "3";
    expect(buildSchedulePatch(values, schedule)).toEqual({ day_of_week: 3 });
  });

  it("returns an empty patch when the lunch window is unchanged", () => {
    expect(
      buildSchedulePatch(scheduleToFormValues(scheduleWithLunch), scheduleWithLunch),
    ).toEqual({});
  });

  it("includes lunch_start/lunch_end when the lunch window changed", () => {
    const values = scheduleToFormValues(scheduleWithLunch);
    values.lunchEnd = "13:30";
    expect(buildSchedulePatch(values, scheduleWithLunch)).toEqual({
      lunch_start: "12:00",
      lunch_end: "13:30",
    });
  });

  it("includes lunch_start/lunch_end when a lunch window is newly added", () => {
    const values = scheduleToFormValues(schedule);
    values.lunchStart = "12:00";
    values.lunchEnd = "13:00";
    expect(buildSchedulePatch(values, schedule)).toEqual({
      lunch_start: "12:00",
      lunch_end: "13:00",
    });
  });

  it("includes remove_lunch when both lunch fields are cleared", () => {
    const values = scheduleToFormValues(scheduleWithLunch);
    values.lunchStart = "";
    values.lunchEnd = "";
    expect(buildSchedulePatch(values, scheduleWithLunch)).toEqual({
      remove_lunch: true,
    });
  });
});

describe("translateScheduleApiError", () => {
  const t = (key: string) => `translated:${key}`;

  it("translates the overlap error", () => {
    expect(
      translateScheduleApiError(
        "this range overlaps another schedule already set for this day",
        t,
      ),
    ).toEqual({ text: "translated:overlapError", isBusinessRuleError: true });
  });

  it("translates the multiple-lunch-breaks error", () => {
    expect(
      translateScheduleApiError(
        "only one schedule range per day can have a lunch break",
        t,
      ),
    ).toEqual({ text: "translated:multipleLunchError", isBusinessRuleError: true });
  });

  it("passes through an unrecognized message unchanged", () => {
    expect(translateScheduleApiError("internal error", t)).toEqual({
      text: "internal error",
      isBusinessRuleError: false,
    });
  });
});
