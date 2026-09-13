import { describe, expect, it } from "vitest";
import { validateContactForm } from "./contact-form-validation";

describe("validateContactForm", () => {
  it("requires name and phone", () => {
    const errors = validateContactForm({ name: "", phone: "" });
    expect(errors.name).toBeDefined();
    expect(errors.phone).toBeDefined();
  });

  it("treats whitespace-only name/phone as missing", () => {
    const errors = validateContactForm({ name: "   ", phone: "  " });
    expect(errors.name).toBeDefined();
    expect(errors.phone).toBeDefined();
  });

  it("passes for a valid name and phone", () => {
    const errors = validateContactForm({ name: "Jane Doe", phone: "8839-3511" });
    expect(errors).toEqual({});
  });

  it("rejects a phone that doesn't look like a real Costa Rica number", () => {
    const errors = validateContactForm({ name: "Jane Doe", phone: "1234-5678" });
    expect(errors.phone).toBeDefined();
  });
});
