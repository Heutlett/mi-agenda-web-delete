import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  authFetch: vi.fn(),
}));

import { authFetch } from "@/lib/auth/session";
import {
  createService,
  deactivateService,
  listServices,
  updateService,
} from "./services";

beforeEach(() => {
  vi.mocked(authFetch).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createService", () => {
  it("POSTs the given fields", async () => {
    vi.mocked(authFetch).mockResolvedValue({ id: "s1" });

    await createService({
      name: "Haircut",
      description: "A classic cut",
      duration_minutes: 30,
      price: "25.00",
    });

    expect(authFetch).toHaveBeenCalledWith("/services", {
      method: "POST",
      body: {
        name: "Haircut",
        description: "A classic cut",
        duration_minutes: 30,
        price: "25.00",
      },
    });
  });
});

describe("listServices", () => {
  it("calls authFetch against /services", async () => {
    const body = [{ id: "s1" }];
    vi.mocked(authFetch).mockResolvedValue(body);

    const result = await listServices();

    expect(authFetch).toHaveBeenCalledWith("/services");
    expect(result).toEqual(body);
  });
});

describe("updateService", () => {
  it("PATCHes only the given fields", async () => {
    vi.mocked(authFetch).mockResolvedValue({ id: "s1", price: "30.50" });

    await updateService("s1", { price: "30.50" });

    expect(authFetch).toHaveBeenCalledWith("/services/s1", {
      method: "PATCH",
      body: { price: "30.50" },
    });
  });
});

describe("deactivateService", () => {
  it("sends a DELETE to /services/{id}", async () => {
    vi.mocked(authFetch).mockResolvedValue(undefined);

    await deactivateService("s1");

    expect(authFetch).toHaveBeenCalledWith("/services/s1", {
      method: "DELETE",
    });
  });
});
