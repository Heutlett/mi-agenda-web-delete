import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  authFetch: vi.fn(),
}));

import { authFetch } from "@/lib/auth/session";
import {
  createAppointment,
  createWalkInAppointment,
  getAppointmentDetail,
  getRevenueTotal,
  listAppointments,
  updateAppointment,
} from "./appointments";
import { ApiError } from "./client";

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:3000";
  vi.stubGlobal("fetch", vi.fn());
  vi.mocked(authFetch).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createAppointment", () => {
  it("POSTs the expected body, omitting email when not given", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: "a1" }),
    } as Response);

    await createAppointment({
      businessSlug: "acme",
      employeeId: "e1",
      serviceId: "s1",
      startTime: "2026-09-10T09:00:00-06:00",
      customer: { name: "Jane Doe", phone: "555-1111" },
    });

    const [calledUrl, init] = vi.mocked(fetch).mock.calls[0];
    expect(new URL(calledUrl as string).pathname).toBe("/appointments");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({
      business_slug: "acme",
      employee_id: "e1",
      service_id: "s1",
      start_time: "2026-09-10T09:00:00-06:00",
      customer: { name: "Jane Doe", phone: "555-1111" },
    });
  });

  it("includes email in the customer object when given", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: "a1" }),
    } as Response);

    await createAppointment({
      businessSlug: "acme",
      employeeId: "e1",
      serviceId: "s1",
      startTime: "2026-09-10T09:00:00-06:00",
      customer: {
        name: "Jane Doe",
        phone: "555-1111",
        email: "jane@example.com",
      },
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(init?.body as string);
    expect(body.customer.email).toBe("jane@example.com");
  });

  it("propagates a 409 as ApiError", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 409,
      statusText: "Conflict",
      text: async () => "that time is no longer available\n",
    } as Response);

    await expect(
      createAppointment({
        businessSlug: "acme",
        employeeId: "e1",
        serviceId: "s1",
        startTime: "2026-09-10T09:00:00-06:00",
        customer: { name: "Jane Doe", phone: "555-1111" },
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("createWalkInAppointment", () => {
  it("omits phone when not given", async () => {
    vi.mocked(authFetch).mockResolvedValue({ id: "a1" });

    await createWalkInAppointment({
      employeeId: "e1",
      serviceId: "s1",
      startTime: "2026-09-10T09:00:00-06:00",
      customer: { name: "Walk-in Customer" },
    });

    expect(authFetch).toHaveBeenCalledWith("/appointments/walk-in", {
      method: "POST",
      body: {
        employee_id: "e1",
        service_id: "s1",
        start_time: "2026-09-10T09:00:00-06:00",
        customer: { name: "Walk-in Customer" },
      },
    });
  });

  it("includes phone when given", async () => {
    vi.mocked(authFetch).mockResolvedValue({ id: "a1" });

    await createWalkInAppointment({
      serviceId: "s1",
      startTime: "2026-09-10T09:00:00-06:00",
      customer: { name: "Walk-in Customer", phone: "555-1111" },
    });

    const body = vi.mocked(authFetch).mock.calls[0][1]?.body as {
      customer: { phone?: string };
    };
    expect(body.customer.phone).toBe("555-1111");
  });

  it("omits employee_id when not given", async () => {
    vi.mocked(authFetch).mockResolvedValue({ id: "a1" });

    await createWalkInAppointment({
      serviceId: "s1",
      startTime: "2026-09-10T09:00:00-06:00",
      customer: { name: "Walk-in Customer" },
    });

    const body = vi.mocked(authFetch).mock.calls[0][1]?.body as object;
    expect(body).not.toHaveProperty("employee_id");
  });
});

describe("listAppointments", () => {
  it("passes no filters by default", async () => {
    vi.mocked(authFetch).mockResolvedValue([]);

    await listAppointments();

    expect(authFetch).toHaveBeenCalledWith("/appointments", {
      params: {
        employee_id: undefined,
        customer_id: undefined,
        start_date: undefined,
        end_date: undefined,
        status: undefined,
      },
    });
  });

  it("forwards the given filters", async () => {
    vi.mocked(authFetch).mockResolvedValue([]);

    await listAppointments({
      employeeId: "e1",
      startDate: "2026-09-01",
      endDate: "2026-09-07",
      status: "CONFIRMED",
      paymentStatus: "PENDING",
    });

    expect(authFetch).toHaveBeenCalledWith("/appointments", {
      params: {
        employee_id: "e1",
        customer_id: undefined,
        start_date: "2026-09-01",
        end_date: "2026-09-07",
        status: "CONFIRMED",
        payment_status: "PENDING",
      },
    });
  });
});

describe("getAppointmentDetail", () => {
  it("calls authFetch against /appointments/{id}", async () => {
    const body = { id: "a1", employee: { id: "e1", name: "Alice" } };
    vi.mocked(authFetch).mockResolvedValue(body);

    const result = await getAppointmentDetail("a1");

    expect(authFetch).toHaveBeenCalledWith("/appointments/a1");
    expect(result).toEqual(body);
  });
});

describe("updateAppointment", () => {
  it("PATCHes the status", async () => {
    vi.mocked(authFetch).mockResolvedValue({ id: "a1", status: "CANCELLED" });

    await updateAppointment("a1", { status: "CANCELLED" });

    expect(authFetch).toHaveBeenCalledWith("/appointments/a1", {
      method: "PATCH",
      body: { status: "CANCELLED" },
    });
  });

  it("PATCHes the price", async () => {
    vi.mocked(authFetch).mockResolvedValue({ id: "a1", price: 18.5 });

    await updateAppointment("a1", { price: "18.50" });

    expect(authFetch).toHaveBeenCalledWith("/appointments/a1", {
      method: "PATCH",
      body: { price: "18.50" },
    });
  });

  it("PATCHes the payment_status", async () => {
    vi.mocked(authFetch).mockResolvedValue({ id: "a1", payment_status: "PAID" });

    await updateAppointment("a1", { payment_status: "PAID" });

    expect(authFetch).toHaveBeenCalledWith("/appointments/a1", {
      method: "PATCH",
      body: { payment_status: "PAID" },
    });
  });

  it("propagates a 409 as ApiError when no longer CONFIRMED", async () => {
    vi.mocked(authFetch).mockRejectedValue(
      new ApiError(409, "the appointment is no longer CONFIRMED"),
    );

    await expect(
      updateAppointment("a1", { status: "COMPLETED" }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("getRevenueTotal", () => {
  it("calls authFetch against /appointments/totals with the given filters", async () => {
    vi.mocked(authFetch).mockResolvedValue({ total: 40 });

    const result = await getRevenueTotal({
      startDate: "2026-09-01",
      endDate: "2026-09-07",
      employeeId: "e1",
    });

    expect(authFetch).toHaveBeenCalledWith("/appointments/totals", {
      params: {
        start_date: "2026-09-01",
        end_date: "2026-09-07",
        employee_id: "e1",
      },
    });
    expect(result).toEqual({ total: 40 });
  });
});
