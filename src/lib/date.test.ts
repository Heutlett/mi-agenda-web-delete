import { describe, expect, it } from "vitest";
import {
  addDays,
  formatClockTime,
  formatDate,
  formatDateTime,
  formatIsoDate,
  localDateKey,
  todayInTimezone,
} from "./date";

describe("todayInTimezone", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(todayInTimezone("America/Costa_Rica")).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});

describe("formatIsoDate", () => {
  it("zero-pads month and day", () => {
    expect(formatIsoDate(2026, 3, 5)).toBe("2026-03-05");
  });
});

describe("formatDate", () => {
  it("formats as a short weekday, month, and day", () => {
    expect(formatDate("2026-09-10")).toBe("Thu, Sep 10");
  });
});

describe("addDays", () => {
  it("adds days within a month", () => {
    expect(addDays("2026-09-10", 3)).toBe("2026-09-13");
  });

  it("rolls over into the next month", () => {
    expect(addDays("2026-09-29", 3)).toBe("2026-10-02");
  });

  it("subtracts with a negative count, rolling back a month", () => {
    expect(addDays("2026-09-02", -5)).toBe("2026-08-28");
  });
});

describe("formatDateTime", () => {
  it("formats an RFC 3339 timestamp with a stable, space-normalized shape", () => {
    const formatted = formatDateTime("2026-09-10T14:00:00.000Z");
    expect(formatted).toMatch(
      /^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2} (AM|PM)$/,
    );
  });
});

describe("formatClockTime", () => {
  it("formats an RFC 3339 timestamp's time of day with a stable shape", () => {
    const formatted = formatClockTime("2026-09-10T14:00:00.000Z");
    expect(formatted).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
  });
});

describe("localDateKey", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(localDateKey("2026-09-10T14:00:00.000Z")).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});
