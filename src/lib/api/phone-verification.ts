import { apiFetch } from "./client";

/**
 * POST /phone-verifications — sends a 6-digit WhatsApp code to `phone`.
 * Superseded by a later call for the same (business, phone) pair.
 *
 * `code` is only present outside production: real delivery depends on an
 * `authentication`-category WhatsApp template that isn't approved yet, so
 * the API includes the code directly there instead, as the only way to
 * exercise this flow end to end for now.
 */
export function sendPhoneVerification(params: {
  businessSlug: string;
  phone: string;
}): Promise<{ expires_at: string; code?: string }> {
  return apiFetch<{ expires_at: string; code?: string }>(
    "/phone-verifications",
    {
      method: "POST",
      body: { business_slug: params.businessSlug, phone: params.phone },
    },
  );
}

/**
 * POST /phone-verifications/confirm — checks `code` against the most recent
 * one sent for (business, phone). Throws ApiError(401) if it's wrong,
 * expired, already used, or too many wrong guesses were already made.
 */
export function confirmPhoneVerification(params: {
  businessSlug: string;
  phone: string;
  code: string;
}): Promise<{ verified: boolean }> {
  return apiFetch<{ verified: boolean }>("/phone-verifications/confirm", {
    method: "POST",
    body: {
      business_slug: params.businessSlug,
      phone: params.phone,
      code: params.code,
    },
  });
}

export interface VerifiedCustomerLookup {
  found: boolean;
  name: string;
  email: string | null;
}

/**
 * POST /phone-verifications/lookup — the saved name/email for a phone that
 * was WhatsApp-verified on a prior booking in this business, so a returning
 * customer doesn't have to retype them. `found: false` covers both an
 * unknown phone and a known-but-never-verified one.
 */
export function lookupVerifiedCustomer(params: {
  businessSlug: string;
  phone: string;
}): Promise<VerifiedCustomerLookup> {
  return apiFetch<VerifiedCustomerLookup>("/phone-verifications/lookup", {
    method: "POST",
    body: { business_slug: params.businessSlug, phone: params.phone },
  });
}
