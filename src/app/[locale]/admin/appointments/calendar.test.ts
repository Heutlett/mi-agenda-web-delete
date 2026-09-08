import { describe, expect, it } from "vitest";
import {
  calendarUrl,
  parseDateParam,
  parseOptionalDateParam,
  parseShowCancelledParam,
  parseStatusParam,
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

  it("includes list-mode filters", () => {
    expect(
      calendarUrl({
        view: "list",
        start: "2026-09-01",
        end: "2026-09-30",
        status: "CONFIRMED",
      }),
    ).toBe(
      "/admin/appointments?view=list&start=2026-09-01&end=2026-09-30&status=CONFIRMED",
    );
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

describe("parseOptionalDateParam", () => {
  it("parses a valid date", () => {
    expect(parseOptionalDateParam("2026-09-10")).toBe("2026-09-10");
  });

  it("returns undefined when missing or malformed", () => {
    expect(parseOptionalDateParam(null)).toBeUndefined();
    expect(parseOptionalDateParam("not-a-date")).toBeUndefined();
  });
});

describe("parseStatusParam", () => {
  it("parses a valid status", () => {
    expect(parseStatusParam("CONFIRMED")).toBe("CONFIRMED");
    expect(parseStatusParam("CANCELLED")).toBe("CANCELLED");
    expect(parseStatusParam("COMPLETED")).toBe("COMPLETED");
  });

  it("returns undefined when missing or invalid", () => {
    expect(parseStatusParam(null)).toBeUndefined();
    expect(parseStatusParam("confirmed")).toBeUndefined();
    expect(parseStatusParam("PENDING")).toBeUndefined();
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
  it("parses 'day' and 'list'", () => {
    expect(parseViewParam("day")).toBe("day");
    expect(parseViewParam("list")).toBe("list");
  });

  it("defaults to 'week' for anything else", () => {
    expect(parseViewParam(null)).toBe("week");
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
