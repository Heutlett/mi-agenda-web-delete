import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  authFetch: vi.fn(),
}));

import { authFetch } from "@/lib/auth/session";
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  updateSchedule,
} from "./schedules";

beforeEach(() => {
  vi.mocked(authFetch).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createSchedule", () => {
  it("POSTs the given fields", async () => {
    vi.mocked(authFetch).mockResolvedValue({ id: "sc1" });

    await createSchedule({
      employee_id: "e1",
      day_of_week: 1,
      start_time: "09:00",
      end_time: "17:00",
    });

    expect(authFetch).toHaveBeenCalledWith("/schedules", {
      method: "POST",
      body: {
        employee_id: "e1",
        day_of_week: 1,
        start_time: "09:00",
        end_time: "17:00",
      },
    });
  });
});

describe("listSchedules", () => {
  it("calls authFetch with no params when no employee id is given", async () => {
    const body = [{ id: "sc1" }];
    vi.mocked(authFetch).mockResolvedValue(body);

    const result = await listSchedules();

    expect(authFetch).toHaveBeenCalledWith("/schedules", {
      params: undefined,
    });
    expect(result).toEqual(body);
  });

  it("filters by employee_id when given", async () => {
    vi.mocked(authFetch).mockResolvedValue([]);

    await listSchedules("e1");

    expect(authFetch).toHaveBeenCalledWith("/schedules", {
      params: { employee_id: "e1" },
    });
  });
});

describe("updateSchedule", () => {
  it("PATCHes only the given fields", async () => {
    vi.mocked(authFetch).mockResolvedValue({ id: "sc1", start_time: "10:00" });

    await updateSchedule("sc1", { start_time: "10:00" });

    expect(authFetch).toHaveBeenCalledWith("/schedules/sc1", {
      method: "PATCH",
      body: { start_time: "10:00" },
    });
  });
});

describe("deleteSchedule", () => {
  it("sends a DELETE to /schedules/{id}", async () => {
    vi.mocked(authFetch).mockResolvedValue(undefined);

    await deleteSchedule("sc1");

    expect(authFetch).toHaveBeenCalledWith("/schedules/sc1", {
      method: "DELETE",
    });
  });
});
