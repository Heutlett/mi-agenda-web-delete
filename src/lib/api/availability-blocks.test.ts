import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  authFetch: vi.fn(),
}));

import { authFetch } from "@/lib/auth/session";
import {
  createAvailabilityBlock,
  deleteAvailabilityBlock,
  listAvailabilityBlocks,
} from "./availability-blocks";

beforeEach(() => {
  vi.mocked(authFetch).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createAvailabilityBlock", () => {
  it("POSTs the given fields", async () => {
    vi.mocked(authFetch).mockResolvedValue({ id: "ab1" });

    await createAvailabilityBlock({
      employee_id: "e1",
      start_time: "2026-09-01T00:00:00.000Z",
      end_time: "2026-09-08T00:00:00.000Z",
      reason: "Vacation",
    });

    expect(authFetch).toHaveBeenCalledWith("/availability/blocks", {
      method: "POST",
      body: {
        employee_id: "e1",
        start_time: "2026-09-01T00:00:00.000Z",
        end_time: "2026-09-08T00:00:00.000Z",
        reason: "Vacation",
      },
    });
  });
});

describe("listAvailabilityBlocks", () => {
  it("calls authFetch with no params when no employee id is given", async () => {
    const body = [{ id: "ab1" }];
    vi.mocked(authFetch).mockResolvedValue(body);

    const result = await listAvailabilityBlocks();

    expect(authFetch).toHaveBeenCalledWith("/availability/blocks", {
      params: undefined,
    });
    expect(result).toEqual(body);
  });

  it("filters by employee_id when given", async () => {
    vi.mocked(authFetch).mockResolvedValue([]);

    await listAvailabilityBlocks("e1");

    expect(authFetch).toHaveBeenCalledWith("/availability/blocks", {
      params: { employee_id: "e1" },
    });
  });
});

describe("deleteAvailabilityBlock", () => {
  it("sends a DELETE to /availability/blocks/{id}", async () => {
    vi.mocked(authFetch).mockResolvedValue(undefined);

    await deleteAvailabilityBlock("ab1");

    expect(authFetch).toHaveBeenCalledWith("/availability/blocks/ab1", {
      method: "DELETE",
    });
  });
});
