import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  authFetch: vi.fn(),
}));

import { authFetch } from "@/lib/auth/session";
import { getBusinessBySlug, getMyBusiness, updateBusiness } from "./business";
import { ApiError } from "./client";

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:3000";
  vi.stubGlobal("fetch", vi.fn());
  vi.mocked(authFetch).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getBusinessBySlug", () => {
  it("requests the slug-encoded path and returns the parsed business", async () => {
    const body = { id: "b1", name: "Acme", services: [], employees: [] };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    } as Response);

    const result = await getBusinessBySlug("acme & co");

    const [calledUrl] = vi.mocked(fetch).mock.calls[0];
    expect(new URL(calledUrl as string).pathname).toBe(
      "/businesses/acme%20%26%20co",
    );
    expect(result).toEqual(body);
  });

  it("propagates a 404 as ApiError", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "not found\n",
    } as Response);

    await expect(getBusinessBySlug("unknown")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("getMyBusiness", () => {
  it("calls authFetch against /businesses/me", async () => {
    const body = { id: "b1", name: "Acme" };
    vi.mocked(authFetch).mockResolvedValue(body);

    const result = await getMyBusiness();

    expect(authFetch).toHaveBeenCalledWith("/businesses/me");
    expect(result).toEqual(body);
  });
});

describe("updateBusiness", () => {
  it("PATCHes only the given fields to /businesses/{id}", async () => {
    const body = { id: "b1", name: "New Name" };
    vi.mocked(authFetch).mockResolvedValue(body);

    const result = await updateBusiness("b1", { name: "New Name" });

    expect(authFetch).toHaveBeenCalledWith("/businesses/b1", {
      method: "PATCH",
      body: { name: "New Name" },
    });
    expect(result).toEqual(body);
  });
});
