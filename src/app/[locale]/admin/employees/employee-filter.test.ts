import { describe, expect, it } from "vitest";
import type { Employee } from "@/lib/api/employees";
import { filterEmployees, sortEmployees } from "./employee-filter";

function employee(overrides: Partial<Employee>): Employee {
  return {
    id: "id",
    business_id: "b1",
    user_id: "u1",
    name: "Bob the Barber",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    permissions: [],
    ...overrides,
  };
}

describe("filterEmployees", () => {
  const employees = [
    employee({ id: "1", name: "Bob the Barber" }),
    employee({ id: "2", name: "Alice Stylist" }),
    employee({ id: "3", name: "Bobbie Cutter" }),
  ];

  it("returns everything with no query", () => {
    expect(filterEmployees(employees, "")).toHaveLength(3);
  });

  it("matches a query against the name, case-insensitively", () => {
    const result = filterEmployees(employees, "bob");
    expect(result.map((e) => e.id)).toEqual(["1", "3"]);
  });

  it("returns nothing when the query matches no employee", () => {
    expect(filterEmployees(employees, "zzz")).toEqual([]);
  });
});

describe("sortEmployees", () => {
  const employees = [
    employee({ id: "1", name: "Bob the Barber" }),
    employee({ id: "2", name: "Alice Stylist" }),
    employee({ id: "3", name: "Charlie Trimmer" }),
  ];

  it("sorts by name ascending", () => {
    const result = sortEmployees(employees, { column: "name", direction: "asc" });
    expect(result.map((e) => e.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts by name descending", () => {
    const result = sortEmployees(employees, {
      column: "name",
      direction: "desc",
    });
    expect(result.map((e) => e.id)).toEqual(["3", "1", "2"]);
  });

  it("does not mutate the original array", () => {
    const original = [...employees];
    sortEmployees(employees, { column: "name", direction: "asc" });
    expect(employees).toEqual(original);
  });
});
