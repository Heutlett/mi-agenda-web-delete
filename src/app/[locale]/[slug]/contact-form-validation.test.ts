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
    const errors = validateContactForm({ name: "Jane Doe", phone: "555-1111" });
    expect(errors).toEqual({});
  });
});
