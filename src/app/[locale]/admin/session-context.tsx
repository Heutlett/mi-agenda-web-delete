"use client";

import { createContext, type ReactNode, useContext } from "react";

export interface Session {
  userId: string;
  businessId: string;
  name: string;
  role: "admin" | "employee";
  /**
   * Permissions granted to this employee (see the employee module's
   * PermissionViewCustomers/PermissionBanCustomers). Always empty for an
   * admin, who isn't gated by these — check `role` first.
   */
  permissions: string[];
}

/** True for an admin, or an employee granted permission. Admin is never gated by these. */
export function hasPermission(session: Session, permission: string): boolean {
  return session.role === "admin" || session.permissions.includes(permission);
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: Session;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}

/** The authenticated admin session. Only usable inside AuthGuard's protected subtree. */
export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error(
      "useSession() was called outside an authenticated /admin route",
    );
  }
  return session;
}
