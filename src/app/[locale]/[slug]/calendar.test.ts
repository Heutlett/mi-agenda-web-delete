import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  formatDate,
  formatMonthParam,
  monthLabel,
  parseMonthParam,
  shiftMonth,
  todayInTimezone,
} from "./calendar";

describe("todayInTimezone", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(todayInTimezone("America/Costa_Rica")).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});

describe("parseMonthParam", () => {
  it("parses a valid YYYY-MM param", () => {
    expect(parseMonthParam("2026-03", "2026-09-15")).toEqual({
      year: 2026,
      month: 3,
    });
  });

  it("falls back to the fallback date's year/month when missing", () => {
    expect(parseMonthParam(undefined, "2026-09-15")).toEqual({
      year: 2026,
      month: 9,
    });
  });

  it("falls back when the param is malformed or out of range", () => {
    expect(parseMonthParam("not-a-month", "2026-09-15")).toEqual({
      year: 2026,
      month: 9,
    });
    expect(parseMonthParam("2026-13", "2026-09-15")).toEqual({
      year: 2026,
      month: 9,
    });
  });
});

describe("formatMonthParam", () => {
  it("formats as zero-padded YYYY-MM", () => {
    expect(formatMonthParam({ year: 2026, month: 3 })).toBe("2026-03");
  });
});

describe("shiftMonth", () => {
  it("moves forward within a year", () => {
    expect(shiftMonth({ year: 2026, month: 3 }, 1)).toEqual({
      year: 2026,
      month: 4,
    });
  });

  it("rolls over into the next year", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({
      year: 2027,
      month: 1,
    });
  });

  it("rolls back into the previous year", () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({
      year: 2025,
      month: 12,
    });
  });
});

describe("buildMonthGrid", () => {
  it("pads the first week so the 1st lands on its correct weekday (Monday-first)", () => {
    // September 2026: the 1st is a Tuesday, so week 1 should have one leading blank.
    const grid = buildMonthGrid({ year: 2026, month: 9 });
    expect(grid[0]).toEqual([
      null,
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
    ]);
  });

  it("includes every day of the month exactly once", () => {
    const grid = buildMonthGrid({ year: 2026, month: 9 });
    const days = grid.flat().filter((d): d is string => d !== null);
    expect(days).toHaveLength(30);
    expect(days[0]).toBe("2026-09-01");
    expect(days[days.length - 1]).toBe("2026-09-30");
  });

  it("pads every week to 7 cells", () => {
    const grid = buildMonthGrid({ year: 2026, month: 9 });
    for (const week of grid) {
      expect(week).toHaveLength(7);
    }
  });
});

describe("monthLabel", () => {
  it("formats as a long month name and year", () => {
    expect(monthLabel({ year: 2026, month: 9 })).toBe("September 2026");
  });
});

describe("formatDate", () => {
  it("formats as a short weekday, month, and day", () => {
    expect(formatDate("2026-09-10")).toBe("Thu, Sep 10");
  });
});
