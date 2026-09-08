"use client";

import {
  Building2,
  CalendarDays,
  CalendarOff,
  Clock,
  Contact,
  History,
  ListChecks,
  type LucideIcon,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { hasPermission, useSession, type Session } from "./session-context";

interface NavItem {
  href: string;
  labelKey: "myCalendar" | "business" | "employees" | "services" | "schedules" | "availability" | "customers" | "history";
  icon: LucideIcon;
  /** Every nav item requires a session; this one additionally requires the admin role. */
  adminOnly?: boolean;
  /** Visible to an employee only once granted this permission (admin always sees it). */
  permission?: string;
  /** The entry point after logging in: a distinct look sets it apart from the settings-style items below it. */
  primary?: boolean;
}

// Matches each module's own role/permission requirement in mi-agenda-api's
// endpoints-reference.md. Business and appointments are visible to any
// authenticated role (an employee's own view is scoped server-side);
// customers additionally requires the view_customers permission; the rest
// stay admin-only.
const NAV_ITEMS: NavItem[] = [
  {
    href: "/admin/appointments",
    labelKey: "myCalendar",
    icon: CalendarDays,
    primary: true,
  },
  { href: "/admin/business", labelKey: "business", icon: Building2 },
  {
    href: "/admin/employees",
    labelKey: "employees",
    icon: Users,
    adminOnly: true,
  },
  {
    href: "/admin/services",
    labelKey: "services",
    icon: ListChecks,
    adminOnly: true,
  },
  {
    href: "/admin/schedules",
    labelKey: "schedules",
    icon: Clock,
    adminOnly: true,
  },
  {
    href: "/admin/availability",
    labelKey: "availability",
    icon: CalendarOff,
    adminOnly: true,
  },
  {
    href: "/admin/customers",
    labelKey: "customers",
    icon: Contact,
    permission: "view_customers",
  },
  { href: "/admin/history", labelKey: "history", icon: History },
];

function isVisible(item: NavItem, session: Session): boolean {
  if (item.adminOnly) return session.role === "admin";
  if (item.permission) return hasPermission(session, item.permission);
  return true;
}

export function AdminNav() {
  const t = useTranslations("AdminNav");
  const pathname = usePathname();
  const session = useSession();
  const items = NAV_ITEMS.filter((item) => isVisible(item, session));

  return (
    <nav className="flex shrink-0 gap-1 overflow-x-auto border-b p-2 md:w-52 md:flex-col md:border-r md:border-b-0 md:p-4">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap",
              item.primary
                ? cn(
                    "font-semibold",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 text-primary hover:bg-primary/15",
                  )
                : active
                  ? "bg-muted font-medium"
                  : "text-muted-foreground hover:bg-muted/50",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
