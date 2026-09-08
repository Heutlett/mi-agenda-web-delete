import { describe, expect, it } from "vitest";
import {
  TIMEZONE_VALUES,
  timezoneOptions,
  withCurrentTimezone,
} from "./timezones";

const options = timezoneOptions((key) => key);

describe("timezoneOptions", () => {
  it("builds one option per timezone value, in order", () => {
    expect(options.map((option) => option.value)).toEqual([
      ...TIMEZONE_VALUES,
    ]);
  });
});

describe("withCurrentTimezone", () => {
  it("returns the list unchanged when the current timezone is already in it", () => {
    expect(withCurrentTimezone("America/Costa_Rica", options)).toBe(options);
  });

  it("prepends the current timezone as its own option when it isn't in the list", () => {
    const result = withCurrentTimezone("Europe/Madrid", options);
    expect(result[0]).toEqual({
      value: "Europe/Madrid",
      label: "Europe/Madrid",
    });
    expect(result).toHaveLength(options.length + 1);
  });
});
