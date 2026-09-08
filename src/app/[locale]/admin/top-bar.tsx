"use client";

import { Suspense } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { AccountMenu } from "./account-menu";
import type { Session } from "./session-context";

/**
 * Shared top bar for every /admin/* route. Shown without an account menu
 * on public routes (login, etc.) and while the session is still loading;
 * once authenticated, the avatar menu names who's logged in and which
 * dashboard they're in (admin vs employee), plus the few account-level
 * actions (change password, log out) — a common account-dropdown pattern,
 * not a bespoke one.
 */
export function TopBar({ session }: { session: Session | null }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b px-6 py-4">
      <span className="text-sm font-semibold">mi-agenda</span>
      <div className="flex items-center gap-3">
        <Suspense fallback={null}>
          <LanguageSwitcher />
        </Suspense>
        {session && <AccountMenu session={session} />}
      </div>
    </header>
  );
}
