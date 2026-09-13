import { describe, expect, it } from "vitest";
import type { AvailabilityBlock } from "@/lib/api/availability-blocks";
import {
  blockToFormValues,
  buildBlockTimeRange,
  defaultBlockForm,
  validateBlockForm,
} from "./block-form";

const block: AvailabilityBlock = {
  id: "b1",
  business_id: "biz1",
  employee_id: "e1",
  start_time: "2026-09-08T18:00:00.000Z", // noon in America/Bogota (UTC-5)
  end_time: "2026-09-08T18:30:00.000Z",
  reason: "Lunch run",
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
};

describe("defaultBlockForm", () => {
  it("defaults the end 30 minutes after the given start", () => {
    expect(defaultBlockForm("2026-09-08", 720, "Busy")).toEqual({
      date: "2026-09-08",
      startTime: "12:00",
      endTime: "12:30",
      reason: "Busy",
    });
  });
});

describe("blockToFormValues", () => {
  it("maps an existing block's instants to wall-clock date/time in the business timezone", () => {
    expect(blockToFormValues(block, "America/Bogota")).toEqual({
      date: "2026-09-08",
      startTime: "13:00",
      endTime: "13:30",
      reason: "Lunch run",
    });
  });

  it("falls back to an empty reason when the block has none", () => {
    const noReason = { ...block, reason: null };
    expect(blockToFormValues(noReason, "America/Bogota").reason).toBe("");
  });
});

describe("validateBlockForm", () => {
  it("requires date, start, and end", () => {
    const errors = validateBlockForm({
      date: "",
      startTime: "",
      endTime: "",
      reason: "",
    });
    expect(errors.date).toBeDefined();
    expect(errors.startTime).toBeDefined();
    expect(errors.endTime).toBeDefined();
  });

  it("rejects an end time before or equal to the start time", () => {
    expect(
      validateBlockForm({
        date: "2026-09-08",
        startTime: "13:00",
        endTime: "12:00",
        reason: "",
      }).endTime,
    ).toBeDefined();
    expect(
      validateBlockForm({
        date: "2026-09-08",
        startTime: "13:00",
        endTime: "13:00",
        reason: "",
      }).endTime,
    ).toBeDefined();
  });

  it("passes for a valid range", () => {
    expect(
      validateBlockForm({
        date: "2026-09-08",
        startTime: "12:00",
        endTime: "12:30",
        reason: "Busy",
      }),
    ).toEqual({});
  });
});

describe("buildBlockTimeRange", () => {
  it("converts wall-clock date/time in the business timezone to RFC 3339 instants", () => {
    const range = buildBlockTimeRange(
      { date: "2026-09-08", startTime: "13:00", endTime: "13:30", reason: "" },
      "America/Bogota",
    );
    expect(new Date(range.startISO).toISOString()).toBe(
      "2026-09-08T18:00:00.000Z",
    );
    expect(new Date(range.endISO).toISOString()).toBe(
      "2026-09-08T18:30:00.000Z",
    );
  });
});
