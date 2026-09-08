import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmPhoneVerification,
  lookupVerifiedCustomer,
  sendPhoneVerification,
} from "./phone-verification";
import { ApiError } from "./client";

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:3000";
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sendPhoneVerification", () => {
  it("POSTs business_slug and phone", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ expires_at: "2026-09-10T09:10:00Z" }),
    } as Response);

    await sendPhoneVerification({ businessSlug: "acme", phone: "50688390000" });

    const [calledUrl, init] = vi.mocked(fetch).mock.calls[0];
    expect(new URL(calledUrl as string).pathname).toBe("/phone-verifications");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      business_slug: "acme",
      phone: "50688390000",
    });
  });
});

describe("confirmPhoneVerification", () => {
  it("POSTs business_slug, phone, and code", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ verified: true }),
    } as Response);

    await confirmPhoneVerification({
      businessSlug: "acme",
      phone: "50688390000",
      code: "123456",
    });

    const [calledUrl, init] = vi.mocked(fetch).mock.calls[0];
    expect(new URL(calledUrl as string).pathname).toBe(
      "/phone-verifications/confirm",
    );
    expect(JSON.parse(init?.body as string)).toEqual({
      business_slug: "acme",
      phone: "50688390000",
      code: "123456",
    });
  });

  it("propagates a wrong/expired code as ApiError(401)", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "code is invalid or expired\n",
    } as Response);

    await expect(
      confirmPhoneVerification({
        businessSlug: "acme",
        phone: "50688390000",
        code: "000000",
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("lookupVerifiedCustomer", () => {
  it("POSTs business_slug and phone, returning the found result", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        found: true,
        name: "Jane Doe",
        email: "jane@example.com",
      }),
    } as Response);

    const result = await lookupVerifiedCustomer({
      businessSlug: "acme",
      phone: "50688390000",
    });

    const [calledUrl, init] = vi.mocked(fetch).mock.calls[0];
    expect(new URL(calledUrl as string).pathname).toBe(
      "/phone-verifications/lookup",
    );
    expect(JSON.parse(init?.body as string)).toEqual({
      business_slug: "acme",
      phone: "50688390000",
    });
    expect(result).toEqual({
      found: true,
      name: "Jane Doe",
      email: "jane@example.com",
    });
  });
});
