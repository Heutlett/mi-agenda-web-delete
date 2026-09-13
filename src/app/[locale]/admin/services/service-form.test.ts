import { describe, expect, it } from "vitest";
import type { Service } from "@/lib/api/services";
import {
  buildCreateServiceParams,
  buildServicePatch,
  serviceToFormValues,
  validateServiceForm,
} from "./service-form";

const service: Service = {
  id: "s1",
  business_id: "b1",
  name: "Haircut",
  description: "A classic cut",
  duration_minutes: 30,
  price: 25,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  employee_ids: [],
};

describe("serviceToFormValues", () => {
  it("maps a service to form values, falling back for null fields", () => {
    expect(serviceToFormValues(service)).toEqual({
      name: "Haircut",
      description: "A classic cut",
      durationMinutes: "30",
      price: "25",
    });
  });

  it("renders a null description as an empty string", () => {
    expect(serviceToFormValues({ ...service, description: null })).toEqual({
      name: "Haircut",
      description: "",
      durationMinutes: "30",
      price: "25",
    });
  });
});

describe("validateServiceForm", () => {
  it("requires name and duration", () => {
    const errors = validateServiceForm({
      name: "",
      description: "",
      durationMinutes: "",
      price: "",
    });
    expect(errors.name).toBeDefined();
    expect(errors.durationMinutes).toBeDefined();
  });

  it("rejects a zero or negative duration", () => {
    expect(
      validateServiceForm({
        name: "Cut",
        description: "",
        durationMinutes: "0",
        price: "",
      }).durationMinutes,
    ).toBeDefined();
  });

  it("rejects a non-integer duration", () => {
    expect(
      validateServiceForm({
        name: "Cut",
        description: "",
        durationMinutes: "30.5",
        price: "",
      }).durationMinutes,
    ).toBeDefined();
  });

  it("rejects a duration below the 15-minute minimum", () => {
    expect(
      validateServiceForm({
        name: "Cut",
        description: "",
        durationMinutes: "10",
        price: "",
      }).durationMinutes,
    ).toBeDefined();
  });

  it("rejects a duration above the 480-minute maximum", () => {
    expect(
      validateServiceForm({
        name: "Cut",
        description: "",
        durationMinutes: "481",
        price: "",
      }).durationMinutes,
    ).toBeDefined();
  });

  it("rejects a duration not aligned to a 15-minute step", () => {
    expect(
      validateServiceForm({
        name: "Cut",
        description: "",
        durationMinutes: "20",
        price: "",
      }).durationMinutes,
    ).toBeDefined();
  });

  it("accepts the 15-minute minimum and 480-minute maximum", () => {
    expect(
      validateServiceForm({
        name: "Cut",
        description: "",
        durationMinutes: "15",
        price: "",
      }).durationMinutes,
    ).toBeUndefined();
    expect(
      validateServiceForm({
        name: "Cut",
        description: "",
        durationMinutes: "480",
        price: "",
      }).durationMinutes,
    ).toBeUndefined();
  });

  it("rejects a malformed price", () => {
    expect(
      validateServiceForm({
        name: "Cut",
        description: "",
        durationMinutes: "30",
        price: "not-a-price",
      }).price,
    ).toBeDefined();
  });

  it("requires a price", () => {
    expect(
      validateServiceForm({
        name: "Cut",
        description: "",
        durationMinutes: "30",
        price: "",
      }).price,
    ).toBeDefined();
  });

  it("passes for valid values", () => {
    expect(
      validateServiceForm({
        name: "Cut",
        description: "A classic cut",
        durationMinutes: "30",
        price: "25.00",
      }),
    ).toEqual({});
  });
});

describe("buildCreateServiceParams", () => {
  it("omits the optional description when blank", () => {
    expect(
      buildCreateServiceParams({
        name: "Cut",
        description: "",
        durationMinutes: "30",
        price: "25.00",
      }),
    ).toEqual({ name: "Cut", duration_minutes: 30, price: "25.00" });
  });

  it("includes optional fields when given", () => {
    expect(
      buildCreateServiceParams({
        name: "Cut",
        description: "A classic cut",
        durationMinutes: "30",
        price: "25.00",
      }),
    ).toEqual({
      name: "Cut",
      description: "A classic cut",
      duration_minutes: 30,
      price: "25.00",
    });
  });
});

describe("buildServicePatch", () => {
  it("returns an empty patch when nothing changed", () => {
    expect(buildServicePatch(serviceToFormValues(service), service)).toEqual(
      {},
    );
  });

  it("includes only the changed fields", () => {
    const values = serviceToFormValues(service);
    values.price = "30.50";
    expect(buildServicePatch(values, service)).toEqual({ price: "30.50" });
  });

  it("never sends an emptied optional field", () => {
    const values = serviceToFormValues(service);
    values.description = "";
    values.price = "";
    expect(buildServicePatch(values, service)).toEqual({});
  });

  it("converts duration back to a number", () => {
    const values = serviceToFormValues(service);
    values.durationMinutes = "45";
    expect(buildServicePatch(values, service)).toEqual({
      duration_minutes: 45,
    });
  });
});
