import { describe, expect, it } from "vitest";
import { normalizePhone } from "./contact-form-phone";

describe("normalizePhone", () => {
  it("prepends the country code to a bare local number", () => {
    expect(normalizePhone("88393511")).toBe("50688393511");
  });

  it("leaves a number that already carries the country code unchanged", () => {
    expect(normalizePhone("50688393511")).toBe("50688393511");
  });

  it("strips a leading plus and formatting", () => {
    expect(normalizePhone("+506 8839-3511")).toBe("50688393511");
  });

  it("strips formatting from a local number before prepending", () => {
    expect(normalizePhone("8839-3511")).toBe("50688393511");
  });
});
