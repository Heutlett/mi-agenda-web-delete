import { describe, expect, it } from "vitest";
import { validateInviteForm } from "./invite-form-validation";

describe("validateInviteForm", () => {
  it("requires name and email", () => {
    const errors = validateInviteForm({ name: "", email: "" });
    expect(errors.name).toBeDefined();
    expect(errors.email).toBeDefined();
  });

  it("treats whitespace-only values as missing", () => {
    const errors = validateInviteForm({ name: "   ", email: "   " });
    expect(errors.name).toBeDefined();
    expect(errors.email).toBeDefined();
  });

  it("rejects a malformed email", () => {
    expect(
      validateInviteForm({ name: "Bob", email: "not-an-email" }).email,
    ).toBeDefined();
  });

  it("passes for a valid name and email", () => {
    expect(
      validateInviteForm({ name: "Bob", email: "bob@example.com" }),
    ).toEqual({});
  });
});
