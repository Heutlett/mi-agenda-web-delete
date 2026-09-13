"use client";

import { useTranslations } from "next-intl";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link, useRouter } from "@/i18n/navigation";
import { logoutSession } from "@/lib/auth/session";
import type { Session } from "./session-context";

/** A common avatar-triggered account dropdown: who's logged in, and the few account-level actions. */
export function AccountMenu({ session }: { session: Session }) {
  const t = useTranslations("AdminNav");
  const router = useRouter();

  async function handleLogout() {
    await logoutSession();
    router.push("/admin/login");
  }

  const initial = session.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <Popover>
      <PopoverTrigger
        aria-label={session.name}
        className="hover:bg-muted flex items-center gap-2 rounded-full py-1 pr-3 pl-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium">
          {initial}
        </span>
        <span className="hidden flex-col items-start sm:flex">
          <span className="text-sm leading-tight font-medium">
            {session.name}
          </span>
          <span className="text-muted-foreground text-xs leading-tight">
            {session.role === "admin" ? t("adminBadge") : t("employeeBadge")}
          </span>
        </span>
      </PopoverTrigger>
      <PopoverContent>
        <div className="p-1">
          <Link
            href="/admin/profile"
            className="hover:bg-muted block rounded-lg px-2 py-1.5 text-sm"
          >
            {t("profile")}
          </Link>
          <Link
            href="/admin/forgot-password"
            className="hover:bg-muted block rounded-lg px-2 py-1.5 text-sm"
          >
            {t("changePassword")}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="hover:bg-muted block w-full rounded-lg px-2 py-1.5 text-left text-sm"
          >
            {t("logOut")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
