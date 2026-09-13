"use client";

import { Suspense } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { AccountMenu } from "./account-menu";
import type { Session } from "./session-context";

/**
 * Shared top bar for every /admin/* route. On public routes (login, etc.)
 * and while the session is still loading, a plain language switcher lets
 * an unauthenticated visitor pick their own view — there's no business
 * context yet to defer to. Once authenticated, the dashboard's language
 * instead follows the business's own `language` setting (enforced by
 * AuthGuard's redirect effect, admin-editable on the Business settings
 * page), so the switcher gives way to the avatar menu: who's logged in
 * and which dashboard they're in (admin vs employee), plus the few
 * account-level actions (profile, change password, log out).
 */
export function TopBar({ session }: { session: Session | null }) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b px-6 py-4">
      <span className="text-sm font-semibold">mi-agenda</span>
      <div className="flex items-center gap-3">
        {!session && (
          <Suspense fallback={null}>
            <LanguageSwitcher />
          </Suspense>
        )}
        {session && <AccountMenu session={session} />}
      </div>
    </header>
  );
}
