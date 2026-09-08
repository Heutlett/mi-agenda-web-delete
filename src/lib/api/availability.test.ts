import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAvailability } from "./availability";

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:3000";
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getAvailability", () => {
  it("requests /availability with the expected query params", async () => {
    const body = {
      date: "2026-09-10",
      employee_id: "e1",
      service_id: "s1",
      duration_minutes: 30,
      slots: [],
    };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    } as Response);

    const result = await getAvailability({
      businessSlug: "acme",
      employeeId: "e1",
      serviceId: "s1",
      date: "2026-09-10",
    });

    const [calledUrl] = vi.mocked(fetch).mock.calls[0];
    const url = new URL(calledUrl as string);
    expect(url.pathname).toBe("/availability");
    expect(url.searchParams.get("business_slug")).toBe("acme");
    expect(url.searchParams.get("employee_id")).toBe("e1");
    expect(url.searchParams.get("service_id")).toBe("s1");
    expect(url.searchParams.get("date")).toBe("2026-09-10");
    expect(result).toEqual(body);
  });
});
