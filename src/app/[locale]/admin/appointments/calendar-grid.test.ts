import { describe, expect, it } from "vitest";
import {
  assignLanes,
  businessHoursForDate,
  dateKeyInZone,
  dayOfWeekFor,
  heightPx,
  isWithinWorkingHours,
  lunchWindowsForDate,
  minutesSinceMidnightInZone,
  minutesToTime,
  timeToMinutes,
  topPx,
  zonedTimeToISOString,
} from "./calendar-grid";

describe("assignLanes", () => {
  it("gives a lone item lane 0 of 1", () => {
    const [a] = assignLanes([{ startMinutes: 540, endMinutes: 570 }]);
    expect(a.lane).toBe(0);
    expect(a.lanes).toBe(1);
  });

  it("leaves non-overlapping items each at lane 0 of 1", () => {
    const items = [
      { id: "a", startMinutes: 540, endMinutes: 570 },
      { id: "b", startMinutes: 780, endMinutes: 810 },
    ];
    const laned = assignLanes(items);
    expect(laned.every((l) => l.lane === 0 && l.lanes === 1)).toBe(true);
  });

  it("splits two same-time items into lanes 0 and 1 of 2", () => {
    const items = [
      { id: "a", startMinutes: 540, endMinutes: 570 },
      { id: "b", startMinutes: 540, endMinutes: 570 },
    ];
    const laned = assignLanes(items);
    const lanes = laned.map((l) => l.lane).sort();
    expect(lanes).toEqual([0, 1]);
    expect(laned.every((l) => l.lanes === 2)).toBe(true);
  });

  it("reuses a lane a non-overlapping earlier item already freed", () => {
    // a: 9:00-9:30, b: 9:00-9:15 (overlaps a, so takes lane 1), c:
    // 9:20-9:40 (overlaps a, but not b, since b already ended) — c can
    // reuse b's lane 1 instead of needing a third lane.
    const items = [
      { id: "a", startMinutes: 540, endMinutes: 570 },
      { id: "b", startMinutes: 540, endMinutes: 555 },
      { id: "c", startMinutes: 560, endMinutes: 580 },
    ];
    const laned = assignLanes(items);
    const byId = Object.fromEntries(
      laned.map((l) => [(l.item as { id: string }).id, l]),
    );
    expect(byId.a.lane).toBe(0);
    expect(byId.b.lane).toBe(1);
    expect(byId.c.lane).toBe(1);
    expect(byId.c.lane).not.toBe(byId.a.lane);
  });
});

describe("topPx / heightPx", () => {
  it("computes zero offset for an item starting at the grid's own start", () => {
    expect(topPx(540, 540)).toBe(0);
  });

  it("scales offset proportionally to minutes from the grid start", () => {
    // 60 minutes past the grid start = 2 slots = 2 * 28px.
    expect(topPx(600, 540)).toBe(56);
  });

  it("a 60-minute block is exactly double the height of a 30-minute one", () => {
    const thirty = heightPx(540, 570);
    const sixty = heightPx(540, 600);
    // Both are inset by the same fixed 2px, so compare heights net of that.
    expect(sixty + 2).toBe((thirty + 2) * 2);
  });
});

describe("timeToMinutes", () => {
  it("parses HH:MM into minutes since midnight", () => {
    expect(timeToMinutes("09:00")).toBe(540);
    expect(timeToMinutes("17:30")).toBe(1050);
    expect(timeToMinutes("00:00")).toBe(0);
  });
});

describe("minutesToTime", () => {
  it("formats minutes since midnight as HH:MM", () => {
    expect(minutesToTime(540)).toBe("09:00");
    expect(minutesToTime(1050)).toBe("17:30");
    expect(minutesToTime(0)).toBe("00:00");
  });

  it("wraps minutes past midnight into the next day", () => {
    expect(minutesToTime(1440)).toBe("00:00");
    expect(minutesToTime(1470)).toBe("00:30");
  });

  it("is the inverse of timeToMinutes", () => {
    expect(minutesToTime(timeToMinutes("14:05"))).toBe("14:05");
  });
});

describe("dayOfWeekFor", () => {
  it("matches JS Date's day-of-week convention (0=Sunday)", () => {
    // 2026-09-08 is a Tuesday.
    expect(dayOfWeekFor("2026-09-08")).toBe(2);
    // 2026-09-06 is a Sunday.
    expect(dayOfWeekFor("2026-09-06")).toBe(0);
  });
});

describe("zonedTimeToISOString / minutesSinceMidnightInZone", () => {
  const COSTA_RICA = "America/Costa_Rica"; // fixed UTC-6, no DST

  it("converts a business-local wall-clock time to the correct UTC instant", () => {
    // 1:00 p.m. in Costa Rica (UTC-6) is 19:00 UTC.
    expect(zonedTimeToISOString("2026-09-08", 13 * 60, COSTA_RICA)).toBe(
      "2026-09-08T19:00:00.000Z",
    );
  });

  it("round-trips through minutesSinceMidnightInZone", () => {
    const iso = zonedTimeToISOString("2026-09-08", 9 * 60 + 30, COSTA_RICA);
    expect(minutesSinceMidnightInZone(iso, COSTA_RICA)).toBe(9 * 60 + 30);
  });

  it("handles a time that crosses midnight in UTC but not in the business zone", () => {
    // 11:30 p.m. Costa Rica time is 05:30 UTC the *next* calendar day.
    const iso = zonedTimeToISOString("2026-09-08", 23 * 60 + 30, COSTA_RICA);
    expect(iso).toBe("2026-09-09T05:30:00.000Z");
    expect(minutesSinceMidnightInZone(iso, COSTA_RICA)).toBe(23 * 60 + 30);
  });
});

describe("dateKeyInZone", () => {
  it("resolves to the business's own calendar date, not UTC's", () => {
    // 2026-09-09T05:30:00Z is still 2026-09-08 in Costa Rica (UTC-6).
    expect(dateKeyInZone("2026-09-09T05:30:00.000Z", "America/Costa_Rica")).toBe(
      "2026-09-08",
    );
  });
});

describe("businessHoursForDate", () => {
  const schedules = [
    {
      id: "s1",
      employee_id: "e1",
      day_of_week: 2,
      start_time: "09:00",
      end_time: "13:00",
      lunch_start: null,
      lunch_end: null,
    },
    {
      id: "s2",
      employee_id: "e1",
      day_of_week: 2,
      start_time: "14:00",
      end_time: "18:00",
      lunch_start: null,
      lunch_end: null,
    },
    {
      id: "s3",
      employee_id: "e1",
      day_of_week: 3,
      start_time: "10:00",
      end_time: "16:00",
      lunch_start: null,
      lunch_end: null,
    },
  ];

  it("spans the earliest start to the latest end across a split shift", () => {
    const hours = businessHoursForDate(schedules, "2026-09-08"); // Tuesday
    expect(hours).toEqual({ startMinutes: 540, endMinutes: 1080 });
  });

  it("falls back to the default 8-20 window when there's no schedule for that day", () => {
    const hours = businessHoursForDate(schedules, "2026-09-10"); // Thursday
    expect(hours).toEqual({ startMinutes: 8 * 60, endMinutes: 20 * 60 });
  });
});

describe("lunchWindowsForDate", () => {
  const schedules = [
    {
      id: "s1",
      employee_id: "e1",
      day_of_week: 2,
      start_time: "09:00",
      end_time: "17:00",
      lunch_start: "12:00",
      lunch_end: "13:00",
    },
    {
      id: "s2",
      employee_id: "e2",
      day_of_week: 2,
      start_time: "10:00",
      end_time: "18:00",
      lunch_start: "13:30",
      lunch_end: "14:00",
    },
    {
      id: "s3",
      employee_id: "e3",
      day_of_week: 2,
      start_time: "09:00",
      end_time: "17:00",
      lunch_start: null,
      lunch_end: null,
    },
  ];

  it("returns one window per employee with a configured lunch", () => {
    const windows = lunchWindowsForDate(schedules, "2026-09-08", new Set());
    expect(windows).toEqual([
      { employeeId: "e1", startMinutes: 720, endMinutes: 780 },
      { employeeId: "e2", startMinutes: 810, endMinutes: 840 },
    ]);
  });

  it("excludes an employee who skipped lunch on this date", () => {
    const windows = lunchWindowsForDate(
      schedules,
      "2026-09-08",
      new Set(["e1"]),
    );
    expect(windows).toEqual([
      { employeeId: "e2", startMinutes: 810, endMinutes: 840 },
    ]);
  });

  it("returns only the first match for an employee with stale duplicate lunch rows on the same day", () => {
    const withDuplicate = [
      ...schedules,
      {
        id: "s1b",
        employee_id: "e1",
        day_of_week: 2,
        start_time: "18:00",
        end_time: "22:00",
        lunch_start: "19:00",
        lunch_end: "19:30",
      },
    ];
    const windows = lunchWindowsForDate(withDuplicate, "2026-09-08", new Set());
    expect(windows).toEqual([
      { employeeId: "e1", startMinutes: 720, endMinutes: 780 },
      { employeeId: "e2", startMinutes: 810, endMinutes: 840 },
    ]);
  });

  it("returns nothing for a day of week with no matching schedule", () => {
    const windows = lunchWindowsForDate(schedules, "2026-09-10", new Set()); // Thursday
    expect(windows).toEqual([]);
  });
});

describe("isWithinWorkingHours", () => {
  const schedules = [
    {
      id: "s1",
      employee_id: "e1",
      day_of_week: 2,
      start_time: "09:00",
      end_time: "17:00",
      lunch_start: "12:00",
      lunch_end: "13:00",
    },
  ];

  it("is true for an interval fully inside the schedule row", () => {
    expect(
      isWithinWorkingHours(schedules, "2026-09-08", 9 * 60, 9 * 60 + 30),
    ).toBe(true);
  });

  it("is false before opening", () => {
    expect(
      isWithinWorkingHours(schedules, "2026-09-08", 3 * 60 + 30, 4 * 60 + 30),
    ).toBe(false);
  });

  it("is false after closing", () => {
    expect(
      isWithinWorkingHours(schedules, "2026-09-08", 18 * 60, 18 * 60 + 30),
    ).toBe(false);
  });

  it("is false over the lunch window", () => {
    expect(
      isWithinWorkingHours(schedules, "2026-09-08", 12 * 60, 12 * 60 + 30),
    ).toBe(false);
  });

  it("is false for a day of week with no matching schedule row, unlike businessHoursForDate's own default-hours fallback", () => {
    expect(
      isWithinWorkingHours(schedules, "2026-09-10", 10 * 60, 10 * 60 + 30),
    ).toBe(false); // Thursday
  });
});
