import { describe, expect, it } from "vitest";
import { periodRange } from "./period";

describe("periodRange", () => {
  it("day is just today", () => {
    expect(periodRange("day", "2026-09-10")).toEqual({
      start: "2026-09-10",
      end: "2026-09-10",
    });
  });

  it("week starts on Monday and ends on Sunday, for a mid-week date", () => {
    // 2026-09-10 is a Thursday.
    expect(periodRange("week", "2026-09-10")).toEqual({
      start: "2026-09-07",
      end: "2026-09-13",
    });
  });

  it("week anchored on a Sunday still resolves to that same week", () => {
    // 2026-09-13 is a Sunday, the last day of the week it's already in.
    expect(periodRange("week", "2026-09-13")).toEqual({
      start: "2026-09-07",
      end: "2026-09-13",
    });
  });

  it("week anchored on a Monday starts on itself", () => {
    expect(periodRange("week", "2026-09-07")).toEqual({
      start: "2026-09-07",
      end: "2026-09-13",
    });
  });

  it("month covers the first through the last day of that month", () => {
    expect(periodRange("month", "2026-09-10")).toEqual({
      start: "2026-09-01",
      end: "2026-09-30",
    });
  });

  it("month handles February in a leap year", () => {
    expect(periodRange("month", "2028-02-15")).toEqual({
      start: "2028-02-01",
      end: "2028-02-29",
    });
  });

  it("month handles February in a non-leap year", () => {
    expect(periodRange("month", "2026-02-15")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });

  it("custom falls back to just today, since the caller supplies its own range", () => {
    expect(periodRange("custom", "2026-09-10")).toEqual({
      start: "2026-09-10",
      end: "2026-09-10",
    });
  });
});
