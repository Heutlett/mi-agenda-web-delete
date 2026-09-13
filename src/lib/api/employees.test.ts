import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  authFetch: vi.fn(),
}));

import { authFetch } from "@/lib/auth/session";
import {
  createEmployee,
  deleteEmployee,
  getCurrentEmployee,
  listEmployees,
  updateEmployee,
} from "./employees";

beforeEach(() => {
  vi.mocked(authFetch).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createEmployee", () => {
  it("POSTs user_id, omitting name when not given", async () => {
    vi.mocked(authFetch).mockResolvedValue({ id: "e1" });

    await createEmployee({ userId: "u1" });

    expect(authFetch).toHaveBeenCalledWith("/employees", {
      method: "POST",
      body: { user_id: "u1" },
    });
  });

  it("includes name when given", async () => {
    vi.mocked(authFetch).mockResolvedValue({ id: "e1" });

    await createEmployee({ userId: "u1", name: "Bob the Barber" });

    expect(authFetch).toHaveBeenCalledWith("/employees", {
      method: "POST",
      body: { user_id: "u1", name: "Bob the Barber" },
    });
  });
});

describe("listEmployees", () => {
  it("calls authFetch against /employees", async () => {
    const body = [{ id: "e1" }];
    vi.mocked(authFetch).mockResolvedValue(body);

    const result = await listEmployees();

    expect(authFetch).toHaveBeenCalledWith("/employees");
    expect(result).toEqual(body);
  });
});

describe("getCurrentEmployee", () => {
  it("calls authFetch against /employees/me", async () => {
    const body = { id: "e1", permissions: ["view_customers"] };
    vi.mocked(authFetch).mockResolvedValue(body);

    const result = await getCurrentEmployee();

    expect(authFetch).toHaveBeenCalledWith("/employees/me");
    expect(result).toEqual(body);
  });
});

describe("updateEmployee", () => {
  it("PATCHes only the given fields", async () => {
    vi.mocked(authFetch).mockResolvedValue({ id: "e1", name: "New Name" });

    await updateEmployee("e1", { name: "New Name" });

    expect(authFetch).toHaveBeenCalledWith("/employees/e1", {
      method: "PATCH",
      body: { name: "New Name" },
    });
  });
});

describe("deleteEmployee", () => {
  it("sends a DELETE to /employees/{id}", async () => {
    vi.mocked(authFetch).mockResolvedValue(undefined);

    await deleteEmployee("e1");

    expect(authFetch).toHaveBeenCalledWith("/employees/e1", {
      method: "DELETE",
    });
  });
});
