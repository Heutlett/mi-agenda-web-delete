import { describe, expect, it } from "vitest";
import { formatDuration, formatPrice, formatTime } from "./format";

describe("formatDuration", () => {
  it("formats minutes under an hour", () => {
    expect(formatDuration(30)).toBe("30min");
  });

  it("formats whole hours with no remainder", () => {
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(120)).toBe("2h");
  });

  it("formats hours with a remainder", () => {
    expect(formatDuration(90)).toBe("1h 30min");
  });

  it("formats zero as 0min", () => {
    expect(formatDuration(0)).toBe("0min");
  });
});

describe("formatPrice", () => {
  it("formats a price to two decimals with the given currency symbol", () => {
    expect(formatPrice(25, "₡")).toBe("₡25.00");
    expect(formatPrice(15.5, "$")).toBe("$15.50");
  });

  it("returns null for a null price", () => {
    expect(formatPrice(null, "₡")).toBeNull();
  });
});

describe("formatTime", () => {
  it("formats a timestamp as a 12-hour clock time in the given timezone", () => {
    expect(formatTime("2026-09-10T09:00:00-06:00", "America/Costa_Rica")).toBe(
      "9:00 AM",
    );
    expect(formatTime("2026-09-10T15:30:00-06:00", "America/Costa_Rica")).toBe(
      "3:30 PM",
    );
  });

  it("converts across timezones rather than reusing the offset in the timestamp", () => {
    expect(formatTime("2026-09-10T09:00:00-06:00", "Asia/Tokyo")).toBe(
      "12:00 AM",
    );
  });
});
