import { describe, expect, it } from "vitest";
import { resolveEmployee } from "./resolve-employee";

const alice = { id: "e1", name: "Alice" };
const bob = { id: "e2", name: "Bob" };

describe("resolveEmployee", () => {
  it("returns 'none' when the business has no employees", () => {
    expect(resolveEmployee([], undefined)).toBe("none");
  });

  it("auto-selects the sole employee regardless of the employeeId param", () => {
    expect(resolveEmployee([alice], undefined)).toEqual(alice);
    expect(resolveEmployee([alice], "some-other-id")).toEqual(alice);
  });

  it("returns 'pending' when there are multiple employees and none is chosen", () => {
    expect(resolveEmployee([alice, bob], undefined)).toBe("pending");
  });

  it("returns the matching employee when employeeId matches one of several", () => {
    expect(resolveEmployee([alice, bob], "e2")).toEqual(bob);
  });

  it("returns 'pending' when employeeId doesn't match any employee", () => {
    expect(resolveEmployee([alice, bob], "unknown-id")).toBe("pending");
  });
});
