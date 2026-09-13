"use client";

import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getMyBusiness, type Business } from "@/lib/api/business";
import { getCurrentEmployee } from "@/lib/api/employees";
import { authFetch } from "@/lib/auth/session";
import { AdminNav } from "./admin-nav";
import { BusinessSettingsProvider } from "./business-context";
import { SessionProvider, type Session } from "./session-context";
import { TopBar } from "./top-bar";

/**
 * The admin dashboard's language follows the business's own `language`
 * setting, not each person's browser — see top-bar.tsx's own comment.
 * Redirects to the matching locale if the current URL isn't already there
 * (e.g. an employee whose browser negotiated a different default, or an
 * admin who just changed it). Renders nothing; split out from AuthGuard
 * only because useSearchParams needs its own Suspense boundary to be
 * statically prerenderable, and AuthGuard itself is too broad to wrap.
 */
function LocaleEnforcer({ business }: { business: Business }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (business.language === locale) return;
    if (!routing.locales.includes(business.language as (typeof routing.locales)[number])) {
      return;
    }
    const query = searchParams.toString();
    router.replace(
      { pathname, query: query ? Object.fromEntries(searchParams) : undefined },
      { locale: business.language },
    );
  }, [business.language, locale, pathname, router, searchParams]);

  return null;
}

// Routes under /admin/* that don't require a session.
export const PUBLIC_ADMIN_PATHS = [
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
];

interface Me {
  user_id: string;
  business_id: string;
  role: "admin" | "employee";
  name: string;
}

/**
 * Guards every /admin/* route except the public ones above: verifies the
 * session via GET /auth/me and redirects to login if it isn't valid.
 * Otherwise renders the authenticated shell (top bar + nav + content) with
 * the resolved session available to all three via useSession() — the nav
 * needs it too (to filter admin-only/permission-gated sections), so it has
 * to live inside this same session boundary rather than being rendered by
 * the layout directly. Also owns the top bar on every route, public or
 * not, since it's the one place that knows whether a session exists yet.
 *
 * modal is the admin/@modal parallel-route slot (an intercepted
 * appointment/customer detail view, or nothing): rendered inside the same
 * SessionProvider/BusinessSettingsProvider boundary as children, since its
 * content also calls useSession()/useBusinessSettings(). Its exact
 * position doesn't affect where it visually appears — the Dialog it
 * renders portals itself to document.body regardless.
 */
export function AuthGuard({
  children,
  modal,
}: {
  children: ReactNode;
  modal?: ReactNode;
}) {
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_ADMIN_PATHS.includes(pathname);

  const [session, setSession] = useState<Session | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [checked, setChecked] = useState(false);

  // Deliberately depends on isPublicRoute, not the raw pathname: this layout
  // (and this component with it) persists across navigations between
  // protected admin pages, so the session should only be re-checked when
  // actually crossing into or out of a public route like /admin/login, not
  // on every sub-navigation within the protected area.
  useEffect(() => {
    if (isPublicRoute) return;

    let cancelled = false;

    authFetch<Me>("/auth/me")
      .then(async (me) => {
        if (cancelled) return;

        // Permissions are deliberately not embedded in the JWT (see
        // employee.getCurrent's doc comment), so an employee's session
        // needs one extra round trip to learn what they're allowed to
        // see. An admin isn't gated by these at all, so it's skipped
        // entirely for that role.
        let permissions: string[] = [];
        if (me.role === "employee") {
          permissions = await getCurrentEmployee()
            .then((employee) => employee.permissions)
            .catch(() => []);
        }
        const loadedBusiness = await getMyBusiness().catch(() => null);
        if (cancelled) return;

        setSession({
          userId: me.user_id,
          businessId: me.business_id,
          name: me.name,
          role: me.role,
          permissions,
        });
        setBusiness(loadedBusiness);
        setChecked(true);
      })
      .catch(() => {
        // authFetch already redirects to login (preserving this path as
        // ?next=) before rejecting; nothing more to do here.
      });

    return () => {
      cancelled = true;
    };
  }, [isPublicRoute]);

  if (isPublicRoute) {
    return (
      <>
        <TopBar session={null} />
        <main className="min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
      </>
    );
  }

  if (!checked || !session || !business) {
    return (
      <>
        <TopBar session={null} />
        <main className="flex min-h-0 flex-1 items-center justify-center p-6">
          <Spinner className="size-6" />
        </main>
      </>
    );
  }

  return (
    <SessionProvider session={session}>
      <BusinessSettingsProvider value={{ business, setBusiness }}>
        <Suspense fallback={null}>
          <LocaleEnforcer business={business} />
        </Suspense>
        <TopBar session={session} />
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <AdminNav />
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
        {modal}
      </BusinessSettingsProvider>
    </SessionProvider>
  );
}
