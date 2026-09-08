import { describe, expect, it } from "vitest";
import type { Schedule } from "@/lib/api/schedules";
import {
  buildCreateScheduleParams,
  buildSchedulePatch,
  scheduleToFormValues,
  validateScheduleForm,
} from "./schedule-form";

const schedule: Schedule = {
  id: "sc1",
  employee_id: "e1",
  day_of_week: 1,
  start_time: "09:00",
  end_time: "17:00",
  status: "active",
};

describe("scheduleToFormValues", () => {
  it("maps a schedule to form values", () => {
    expect(scheduleToFormValues(schedule)).toEqual({
      dayOfWeek: "1",
      startTime: "09:00",
      endTime: "17:00",
    });
  });
});

describe("validateScheduleForm", () => {
  it("requires start and end time", () => {
    const errors = validateScheduleForm({
      dayOfWeek: "1",
      startTime: "",
      endTime: "",
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
      }).endTime,
    ).toBeDefined();
    expect(
      validateScheduleForm({
        dayOfWeek: "1",
        startTime: "09:00",
        endTime: "09:00",
      }).endTime,
    ).toBeDefined();
  });

  it("passes for a valid range", () => {
    expect(
      validateScheduleForm({
        dayOfWeek: "1",
        startTime: "09:00",
        endTime: "17:00",
      }),
    ).toEqual({});
  });
});

describe("buildCreateScheduleParams", () => {
  it("builds the create request", () => {
    expect(
      buildCreateScheduleParams("e1", {
        dayOfWeek: "2",
        startTime: "09:00",
        endTime: "17:00",
      }),
    ).toEqual({
      employee_id: "e1",
      day_of_week: 2,
      start_time: "09:00",
      end_time: "17:00",
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
});
