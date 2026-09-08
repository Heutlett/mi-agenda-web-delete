import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  authFetch: vi.fn(),
}));

import { authFetch } from "@/lib/auth/session";
import { createUser, listUsers } from "./users";

beforeEach(() => {
  vi.mocked(authFetch).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createUser", () => {
  it("POSTs the given params to /users", async () => {
    const body = { id: "u1", claim_token: "tok" };
    vi.mocked(authFetch).mockResolvedValue(body);

    const result = await createUser({
      name: "Bob",
      email: "bob@example.com",
      role: "employee",
    });

    expect(authFetch).toHaveBeenCalledWith("/users", {
      method: "POST",
      body: { name: "Bob", email: "bob@example.com", role: "employee" },
    });
    expect(result).toEqual(body);
  });
});

describe("listUsers", () => {
  it("calls authFetch against /users", async () => {
    const body = [{ id: "u1" }];
    vi.mocked(authFetch).mockResolvedValue(body);

    const result = await listUsers();

    expect(authFetch).toHaveBeenCalledWith("/users");
    expect(result).toEqual(body);
  });
});
