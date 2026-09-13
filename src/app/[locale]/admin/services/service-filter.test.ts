import { describe, expect, it } from "vitest";
import type { Service } from "@/lib/api/services";
import { filterServices, sortServices } from "./service-filter";

function service(overrides: Partial<Service>): Service {
  return {
    id: "id",
    business_id: "b1",
    name: "Haircut",
    description: null,
    duration_minutes: 30,
    price: 25,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    employee_ids: [],
    ...overrides,
  };
}

describe("filterServices", () => {
  const services = [
    service({ id: "1", name: "Haircut" }),
    service({ id: "2", name: "Beard Trim" }),
    service({ id: "3", name: "Hair Coloring" }),
  ];

  it("returns everything with no query", () => {
    expect(filterServices(services, "")).toHaveLength(3);
  });

  it("matches a query against the name, case-insensitively", () => {
    const result = filterServices(services, "hair");
    expect(result.map((s) => s.id)).toEqual(["1", "3"]);
  });

  it("returns nothing when the query matches no service", () => {
    expect(filterServices(services, "zzz")).toEqual([]);
  });
});

describe("sortServices", () => {
  const services = [
    service({ id: "1", name: "Haircut", duration_minutes: 30, price: 25 }),
    service({ id: "2", name: "Beard Trim", duration_minutes: 15, price: 10 }),
    service({
      id: "3",
      name: "Hair Coloring",
      duration_minutes: 60,
      price: 45,
    }),
  ];

  it("sorts by name ascending", () => {
    const result = sortServices(services, { column: "name", direction: "asc" });
    expect(result.map((s) => s.id)).toEqual(["2", "3", "1"]);
  });

  it("sorts by name descending", () => {
    const result = sortServices(services, {
      column: "name",
      direction: "desc",
    });
    expect(result.map((s) => s.id)).toEqual(["1", "3", "2"]);
  });

  it("sorts by price ascending", () => {
    const result = sortServices(services, {
      column: "price",
      direction: "asc",
    });
    expect(result.map((s) => s.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts by duration ascending", () => {
    const result = sortServices(services, {
      column: "duration_minutes",
      direction: "asc",
    });
    expect(result.map((s) => s.id)).toEqual(["2", "1", "3"]);
  });

  it("does not mutate the original array", () => {
    const original = [...services];
    sortServices(services, { column: "name", direction: "asc" });
    expect(services).toEqual(original);
  });
});
