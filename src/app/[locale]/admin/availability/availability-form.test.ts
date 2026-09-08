import { describe, expect, it } from "vitest";
import {
  buildCreateAvailabilityBlockParams,
  validateAvailabilityForm,
} from "./availability-form";

describe("validateAvailabilityForm", () => {
  it("requires start and end", () => {
    const errors = validateAvailabilityForm({
      startTime: "",
      endTime: "",
      reason: "",
    });
    expect(errors.startTime).toBeDefined();
    expect(errors.endTime).toBeDefined();
  });

  it("rejects an end at or before the start", () => {
    expect(
      validateAvailabilityForm({
        startTime: "2026-09-10T14:00",
        endTime: "2026-09-10T10:00",
        reason: "",
      }).endTime,
    ).toBeDefined();
    expect(
      validateAvailabilityForm({
        startTime: "2026-09-10T14:00",
        endTime: "2026-09-10T14:00",
        reason: "",
      }).endTime,
    ).toBeDefined();
  });

  it("passes for a valid range", () => {
    expect(
      validateAvailabilityForm({
        startTime: "2026-09-10T14:00",
        endTime: "2026-09-17T14:00",
        reason: "Vacation",
      }),
    ).toEqual({});
  });
});

describe("buildCreateAvailabilityBlockParams", () => {
  it("converts datetime-local values to matching timestamps, omitting a blank reason", () => {
    const params = buildCreateAvailabilityBlockParams("e1", {
      startTime: "2026-09-10T14:00",
      endTime: "2026-09-17T14:00",
      reason: "",
    });
    expect(params.employee_id).toBe("e1");
    expect(new Date(params.start_time).getTime()).toBe(
      new Date("2026-09-10T14:00").getTime(),
    );
    expect(new Date(params.end_time).getTime()).toBe(
      new Date("2026-09-17T14:00").getTime(),
    );
    expect(params.reason).toBeUndefined();
  });

  it("trims and includes a given reason", () => {
    const params = buildCreateAvailabilityBlockParams("e1", {
      startTime: "2026-09-10T14:00",
      endTime: "2026-09-17T14:00",
      reason: "  Vacation  ",
    });
    expect(params.reason).toBe("Vacation");
  });
});
