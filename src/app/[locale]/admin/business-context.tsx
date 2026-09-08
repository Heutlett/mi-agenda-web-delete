"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { Business } from "@/lib/api/business";

interface BusinessSettingsContextValue {
  /** Null only for the brief moment before its own fetch resolves; consumers needing e.g. currency_symbol should fall back to the same default the backend uses ("₡") while it's null. */
  business: Business | null;
  /** Updates the shared copy in place, e.g. right after a successful PATCH /businesses/{id}, so every page reflects a changed setting (like currency_symbol) immediately without a reload. */
  setBusiness: (business: Business) => void;
}

const BusinessSettingsContext =
  createContext<BusinessSettingsContextValue | null>(null);

export function BusinessSettingsProvider({
  value,
  children,
}: {
  value: BusinessSettingsContextValue;
  children: ReactNode;
}) {
  return (
    <BusinessSettingsContext.Provider value={value}>
      {children}
    </BusinessSettingsContext.Provider>
  );
}

/** The authenticated caller's own business (currency_symbol, timezone, etc). Only usable inside AuthGuard's protected subtree. */
export function useBusinessSettings(): BusinessSettingsContextValue {
  const ctx = useContext(BusinessSettingsContext);
  if (!ctx) {
    throw new Error(
      "useBusinessSettings() was called outside an authenticated /admin route",
    );
  }
  return ctx;
}
