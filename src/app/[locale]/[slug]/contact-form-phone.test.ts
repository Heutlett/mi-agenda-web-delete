import { describe, expect, it } from "vitest";
import { isValidCostaRicaPhone, normalizePhone } from "./contact-form-phone";

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

describe("isValidCostaRicaPhone", () => {
  it("accepts real mobile, landline, and VoIP numbers", () => {
    expect(isValidCostaRicaPhone("50688393511")).toBe(true);
    expect(isValidCostaRicaPhone("50660123456")).toBe(true);
    expect(isValidCostaRicaPhone("50670123456")).toBe(true);
    expect(isValidCostaRicaPhone("50622334455")).toBe(true);
    expect(isValidCostaRicaPhone("50644556677")).toBe(true);
  });

  it("rejects the wrong length", () => {
    expect(isValidCostaRicaPhone("5068839351")).toBe(false);
    expect(isValidCostaRicaPhone("506883935111")).toBe(false);
  });

  it("rejects a leading digit SUTEL never assigns", () => {
    expect(isValidCostaRicaPhone("50690123456")).toBe(false);
    expect(isValidCostaRicaPhone("50600123456")).toBe(false);
    expect(isValidCostaRicaPhone("50610123456")).toBe(false);
  });

  it("rejects every digit being the same", () => {
    expect(isValidCostaRicaPhone("50688888888")).toBe(false);
  });

  it("rejects a number missing the country code entirely", () => {
    expect(isValidCostaRicaPhone("88393511")).toBe(false);
  });
});
