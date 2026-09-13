import { describe, expect, it } from "vitest";
import {
  calendarRangeLabel,
  calendarUrl,
  parseDateParam,
  parseShowCancelledParam,
  parseViewParam,
  weekDates,
} from "./calendar";

describe("calendarUrl", () => {
  it("builds the bare path with no params", () => {
    expect(calendarUrl({})).toBe("/admin/appointments");
  });

  it("includes only the given params, in a stable order", () => {
    expect(
      calendarUrl({ employee: "e1", date: "2026-09-10", view: "day" }),
    ).toBe("/admin/appointments?view=day&date=2026-09-10&employee=e1");
  });

  it("omits the cancelled param by default (cancelled appointments hidden)", () => {
    expect(calendarUrl({ view: "week" })).toBe(
      "/admin/appointments?view=week",
    );
    expect(calendarUrl({ view: "week", showCancelled: false })).toBe(
      "/admin/appointments?view=week",
    );
  });

  it("includes cancelled=show when explicitly shown", () => {
    expect(calendarUrl({ view: "week", showCancelled: true })).toBe(
      "/admin/appointments?view=week&cancelled=show",
    );
  });
});

describe("parseDateParam", () => {
  it("parses a valid date", () => {
    expect(parseDateParam("2026-09-10", "2026-01-01")).toBe("2026-09-10");
  });

  it("falls back when missing or malformed", () => {
    expect(parseDateParam(null, "2026-01-01")).toBe("2026-01-01");
    expect(parseDateParam("not-a-date", "2026-01-01")).toBe("2026-01-01");
  });
});

describe("parseShowCancelledParam", () => {
  it("is false (hidden) when missing", () => {
    expect(parseShowCancelledParam(null)).toBe(false);
  });

  it("is true only for the exact value 'show'", () => {
    expect(parseShowCancelledParam("show")).toBe(true);
    expect(parseShowCancelledParam("true")).toBe(false);
    expect(parseShowCancelledParam("1")).toBe(false);
  });
});

describe("parseViewParam", () => {
  it("parses 'day'", () => {
    expect(parseViewParam("day")).toBe("day");
  });

  it("defaults to 'week' for anything else", () => {
    expect(parseViewParam(null)).toBe("week");
    expect(parseViewParam("list")).toBe("week");
    expect(parseViewParam("month")).toBe("week");
  });
});

describe("weekDates", () => {
  it("returns the Monday-first week containing a mid-week date", () => {
    // 2026-09-10 is a Thursday.
    expect(weekDates("2026-09-10")).toEqual([
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ]);
  });

  it("returns the same week when given the Monday itself", () => {
    expect(weekDates("2026-09-07")).toEqual([
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ]);
  });

  it("returns the same week when given the Sunday", () => {
    expect(weekDates("2026-09-13")).toEqual([
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ]);
  });

  it("handles a week spanning a month boundary", () => {
    // 2026-09-30 is a Wednesday.
    expect(weekDates("2026-09-30")).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
  });
});

describe("calendarRangeLabel", () => {
  it("shows a single month and year for a day view", () => {
    expect(calendarRangeLabel(["2026-09-15"], "en-US")).toBe("September 2026");
  });

  it("shows a single month and year for a week that stays within one month", () => {
    expect(
      calendarRangeLabel(
        ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"],
        "en-US",
      ),
    ).toBe("September 2026");
  });

  it("shows both months, once the year, for a week spanning a month boundary within one year", () => {
    expect(
      calendarRangeLabel(
        ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"],
        "en-US",
      ),
    ).toBe("September – October 2026");
  });

  it("shows the year on both sides for a week spanning a year boundary", () => {
    expect(
      calendarRangeLabel(
        ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"],
        "en-US",
      ),
    ).toBe("December 2026 – January 2027");
  });

  it("formats in Spanish for the es-CR locale, without the connector Intl would insert alongside a year", () => {
    // Regression: asking Intl for month+long and year+numeric together
    // produces "septiembre de 2026" in es-CR, which reads fine in a
    // sentence but not as a standalone calendar heading.
    expect(calendarRangeLabel(["2026-09-15"], "es-CR")).toBe("Septiembre 2026");
  });

  it("still shows the correct months for a Spanish range spanning a month boundary", () => {
    expect(
      calendarRangeLabel(
        ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"],
        "es-CR",
      ),
    ).toBe("Septiembre – Octubre 2026");
  });
});
