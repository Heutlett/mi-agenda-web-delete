import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  authFetch: vi.fn(),
}));

import { authFetch } from "@/lib/auth/session";
import {
  createRecurringAppointment,
  listRecurringAppointments,
  previewRecurringAppointment,
  updateRecurringAppointment,
} from "./recurring-appointments";

beforeEach(() => {
  vi.mocked(authFetch).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createRecurringAppointment", () => {
  it("POSTs the expected body, omitting employeeId when not given", async () => {
    vi.mocked(authFetch).mockResolvedValue({ id: "r1" });

    await createRecurringAppointment({
      customerId: "c1",
      serviceId: "s1",
      dayOfWeek: 2,
      startTime: "09:00",
      startDate: "2026-09-15",
      endDate: "2027-03-15",
    });

    expect(authFetch).toHaveBeenCalledWith("/recurring-appointments", {
      method: "POST",
      body: {
        customer_id: "c1",
        service_id: "s1",
        day_of_week: 2,
        start_time: "09:00",
        start_date: "2026-09-15",
        end_date: "2027-03-15",
      },
    });
  });

  it("includes employee_id and interval_weeks when given", async () => {
    vi.mocked(authFetch).mockResolvedValue({ id: "r1" });

    await createRecurringAppointment({
      customerId: "c1",
      employeeId: "e1",
      serviceId: "s1",
      dayOfWeek: 2,
      startTime: "09:00",
      intervalWeeks: 2,
      startDate: "2026-09-15",
      endDate: "2027-03-15",
    });

    expect(authFetch).toHaveBeenCalledWith("/recurring-appointments", {
      method: "POST",
      body: {
        customer_id: "c1",
        employee_id: "e1",
        service_id: "s1",
        day_of_week: 2,
        start_time: "09:00",
        interval_weeks: 2,
        start_date: "2026-09-15",
        end_date: "2027-03-15",
      },
    });
  });
});

describe("listRecurringAppointments", () => {
  it("passes no filters by default", async () => {
    vi.mocked(authFetch).mockResolvedValue([]);

    await listRecurringAppointments();

    expect(authFetch).toHaveBeenCalledWith("/recurring-appointments", {
      params: {
        employee_id: undefined,
        customer_id: undefined,
        status: undefined,
      },
    });
  });

  it("forwards the given filters", async () => {
    vi.mocked(authFetch).mockResolvedValue([]);

    await listRecurringAppointments({
      employeeId: "e1",
      customerId: "c1",
      status: "all",
    });

    expect(authFetch).toHaveBeenCalledWith("/recurring-appointments", {
      params: {
        employee_id: "e1",
        customer_id: "c1",
        status: "all",
      },
    });
  });
});

describe("updateRecurringAppointment", () => {
  it("PATCHes just the status", async () => {
    vi.mocked(authFetch).mockResolvedValue({ id: "r1", status: "inactive" });

    await updateRecurringAppointment("r1", { status: "inactive" });

    expect(authFetch).toHaveBeenCalledWith("/recurring-appointments/r1", {
      method: "PATCH",
      body: { status: "inactive" },
    });
  });

  it("PATCHes the schedule fields", async () => {
    vi.mocked(authFetch).mockResolvedValue({ id: "r1" });

    await updateRecurringAppointment("r1", {
      serviceId: "s2",
      dayOfWeek: 3,
      startTime: "10:00",
      intervalWeeks: 2,
    });

    expect(authFetch).toHaveBeenCalledWith("/recurring-appointments/r1", {
      method: "PATCH",
      body: {
        service_id: "s2",
        day_of_week: 3,
        start_time: "10:00",
        interval_weeks: 2,
      },
    });
  });

  it("PATCHes end_date to extend or reactivate a rule", async () => {
    vi.mocked(authFetch).mockResolvedValue({ id: "r1", end_date: "2027-09-09" });

    await updateRecurringAppointment("r1", { endDate: "2027-09-09" });

    expect(authFetch).toHaveBeenCalledWith("/recurring-appointments/r1", {
      method: "PATCH",
      body: { end_date: "2027-09-09" },
    });
  });
});

describe("previewRecurringAppointment", () => {
  it("POSTs the same shape createRecurringAppointment does, to the preview path", async () => {
    vi.mocked(authFetch).mockResolvedValue([]);

    await previewRecurringAppointment({
      customerId: "c1",
      employeeId: "e1",
      serviceId: "s1",
      dayOfWeek: 2,
      startTime: "09:00",
      intervalWeeks: 2,
      startDate: "2026-09-15",
      endDate: "2027-03-15",
    });

    expect(authFetch).toHaveBeenCalledWith("/recurring-appointments/preview", {
      method: "POST",
      body: {
        customer_id: "c1",
        employee_id: "e1",
        service_id: "s1",
        day_of_week: 2,
        start_time: "09:00",
        interval_weeks: 2,
        start_date: "2026-09-15",
        end_date: "2027-03-15",
      },
    });
  });

  it("converts each row from snake_case to camelCase", async () => {
    vi.mocked(authFetch).mockResolvedValue([
      { date: "2026-09-15", would_generate: true },
      { date: "2026-09-29", would_generate: false, reason: "slot_unavailable" },
    ]);

    const result = await previewRecurringAppointment({
      customerId: "c1",
      serviceId: "s1",
      dayOfWeek: 2,
      startTime: "09:00",
      startDate: "2026-09-15",
      endDate: "2027-03-15",
    });

    expect(result).toEqual([
      { date: "2026-09-15", wouldGenerate: true, reason: undefined },
      { date: "2026-09-29", wouldGenerate: false, reason: "slot_unavailable" },
    ]);
  });
});
