import { describe, expect, it } from "vitest";
import type { Business } from "@/lib/api/business";
import {
  buildBusinessPatch,
  businessToFormValues,
  validateBusinessForm,
} from "./business-form";

const original: Business = {
  id: "b1",
  name: "Acme Barbershop",
  slug: "acme-barbershop",
  phone: "555-1234",
  email: "hello@acme.test",
  address: "123 Main St",
  timezone: "America/Costa_Rica",
  status: "active",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  max_appointments_per_customer_per_day: 3,
  max_appointments_per_customer_per_week: 7,
  currency_symbol: "₡",
  show_service_prices: true,
};

describe("businessToFormValues", () => {
  it("maps null optional fields to empty strings", () => {
    const business: Business = {
      ...original,
      phone: null,
      email: null,
      address: null,
    };
    expect(businessToFormValues(business)).toEqual({
      name: "Acme Barbershop",
      slug: "acme-barbershop",
      phone: "",
      email: "",
      address: "",
      timezone: "America/Costa_Rica",
      status: "active",
      maxAppointmentsPerCustomerPerDay: "3",
      maxAppointmentsPerCustomerPerWeek: "7",
      currencySymbol: "₡",
    });
  });
});

describe("validateBusinessForm", () => {
  const valid = businessToFormValues(original);

  it("passes for a fully valid form", () => {
    expect(validateBusinessForm(valid)).toEqual({});
  });

  it("requires name", () => {
    expect(validateBusinessForm({ ...valid, name: "  " }).name).toBeDefined();
  });

  it("requires slug", () => {
    expect(validateBusinessForm({ ...valid, slug: "" }).slug).toBeDefined();
  });

  it("rejects a malformed slug", () => {
    expect(
      validateBusinessForm({ ...valid, slug: "Not Valid!" }).slug,
    ).toBeDefined();
    expect(
      validateBusinessForm({ ...valid, slug: "double--hyphen" }).slug,
    ).toBeDefined();
    expect(
      validateBusinessForm({ ...valid, slug: "multi-word-slug" }).slug,
    ).toBeUndefined();
  });

  it("requires timezone", () => {
    expect(
      validateBusinessForm({ ...valid, timezone: "" }).timezone,
    ).toBeDefined();
  });

  it("requires a positive whole number for the daily and weekly limits", () => {
    expect(
      validateBusinessForm({ ...valid, maxAppointmentsPerCustomerPerDay: "0" })
        .maxAppointmentsPerCustomerPerDay,
    ).toBeDefined();
    expect(
      validateBusinessForm({ ...valid, maxAppointmentsPerCustomerPerDay: "abc" })
        .maxAppointmentsPerCustomerPerDay,
    ).toBeDefined();
    expect(
      validateBusinessForm({
        ...valid,
        maxAppointmentsPerCustomerPerWeek: "-1",
      }).maxAppointmentsPerCustomerPerWeek,
    ).toBeDefined();
  });

  it("requires a currency symbol", () => {
    expect(
      validateBusinessForm({ ...valid, currencySymbol: "  " }).currencySymbol,
    ).toBeDefined();
  });

  it("does not require phone, email, or address", () => {
    const errors = validateBusinessForm({
      ...valid,
      phone: "",
      email: "",
      address: "",
    });
    expect(errors.phone).toBeUndefined();
    expect(errors.email).toBeUndefined();
    expect(errors.address).toBeUndefined();
  });
});

describe("buildBusinessPatch", () => {
  it("returns an empty patch when nothing changed", () => {
    const values = businessToFormValues(original);
    expect(buildBusinessPatch(values, original)).toEqual({});
  });

  it("includes only fields that actually changed", () => {
    const values = { ...businessToFormValues(original), name: "New Name" };
    expect(buildBusinessPatch(values, original)).toEqual({ name: "New Name" });
  });

  it("includes a status change even though it's not a text field", () => {
    const values = {
      ...businessToFormValues(original),
      status: "inactive" as const,
    };
    expect(buildBusinessPatch(values, original)).toEqual({
      status: "inactive",
    });
  });

  it("never sends an empty string for phone/email/address, even if the field was cleared", () => {
    const values = {
      ...businessToFormValues(original),
      phone: "",
      email: "",
      address: "",
    };
    const patch = buildBusinessPatch(values, original);
    expect(patch.phone).toBeUndefined();
    expect(patch.email).toBeUndefined();
    expect(patch.address).toBeUndefined();
  });

  it("never sends an empty string for name or slug, even if cleared", () => {
    const values = {
      ...businessToFormValues(original),
      name: "  ",
      slug: "  ",
    };
    const patch = buildBusinessPatch(values, original);
    expect(patch.name).toBeUndefined();
    expect(patch.slug).toBeUndefined();
  });

  it("trims whitespace before comparing and sending", () => {
    const values = {
      ...businessToFormValues(original),
      name: "  Acme Barbershop  ",
    };
    expect(buildBusinessPatch(values, original)).toEqual({});
  });

  it("includes a change to the daily or weekly appointment limit", () => {
    const values = {
      ...businessToFormValues(original),
      maxAppointmentsPerCustomerPerDay: "5",
    };
    expect(buildBusinessPatch(values, original)).toEqual({
      max_appointments_per_customer_per_day: 5,
    });
  });

  it("includes a change to the currency symbol", () => {
    const values = { ...businessToFormValues(original), currencySymbol: "$" };
    expect(buildBusinessPatch(values, original)).toEqual({
      currency_symbol: "$",
    });
  });

  it("never sends an empty currency symbol, even if cleared", () => {
    const values = { ...businessToFormValues(original), currencySymbol: "  " };
    expect(buildBusinessPatch(values, original).currency_symbol).toBeUndefined();
  });

  it("picks up a previously-null field being set for the first time", () => {
    const withoutPhone: Business = { ...original, phone: null };
    const values = { ...businessToFormValues(withoutPhone), phone: "555-9999" };
    expect(buildBusinessPatch(values, withoutPhone)).toEqual({
      phone: "555-9999",
    });
  });
});
