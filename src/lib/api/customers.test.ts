import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  authFetch: vi.fn(),
}));

import { authFetch } from "@/lib/auth/session";
import {
  banCustomer,
  getCustomer,
  listCustomers,
  lookupCustomerByPhone,
  unbanCustomer,
} from "./customers";

beforeEach(() => {
  vi.mocked(authFetch).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listCustomers", () => {
  it("calls authFetch with no params when no query is given", async () => {
    const body = [{ id: "c1" }];
    vi.mocked(authFetch).mockResolvedValue(body);

    const result = await listCustomers();

    expect(authFetch).toHaveBeenCalledWith("/customers", {
      params: undefined,
    });
    expect(result).toEqual(body);
  });

  it("searches by q when given", async () => {
    vi.mocked(authFetch).mockResolvedValue([]);

    await listCustomers("jane");

    expect(authFetch).toHaveBeenCalledWith("/customers", {
      params: { q: "jane" },
    });
  });
});

describe("getCustomer", () => {
  it("calls authFetch with the customer's id", async () => {
    const body = { id: "c1" };
    vi.mocked(authFetch).mockResolvedValue(body);

    const result = await getCustomer("c1");

    expect(authFetch).toHaveBeenCalledWith("/customers/c1");
    expect(result).toEqual(body);
  });
});

describe("banCustomer", () => {
  it("posts the reason to /customers/{id}/ban", async () => {
    const body = { id: "c1", banned_at: "2026-01-01T00:00:00Z" };
    vi.mocked(authFetch).mockResolvedValue(body);

    const result = await banCustomer("c1", "missed too many appointments");

    expect(authFetch).toHaveBeenCalledWith("/customers/c1/ban", {
      method: "POST",
      body: { reason: "missed too many appointments" },
    });
    expect(result).toEqual(body);
  });
});

describe("lookupCustomerByPhone", () => {
  it("calls authFetch with the phone as a query param", async () => {
    const body = { found: true, name: "Jane Doe" };
    vi.mocked(authFetch).mockResolvedValue(body);

    const result = await lookupCustomerByPhone("50688393511");

    expect(authFetch).toHaveBeenCalledWith("/customers/lookup", {
      params: { phone: "50688393511" },
    });
    expect(result).toEqual(body);
  });
});

describe("unbanCustomer", () => {
  it("posts to /customers/{id}/unban", async () => {
    const body = { id: "c1", banned_at: null };
    vi.mocked(authFetch).mockResolvedValue(body);

    const result = await unbanCustomer("c1");

    expect(authFetch).toHaveBeenCalledWith("/customers/c1/unban", {
      method: "POST",
    });
    expect(result).toEqual(body);
  });
});
