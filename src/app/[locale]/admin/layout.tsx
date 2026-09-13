import { AuthGuard } from "./auth-guard";

/**
 * Shared shell for the authenticated admin dashboard at /admin/*. AuthGuard
 * owns everything else — the top bar, enforcing the session, and rendering
 * the nav + page content once authenticated — since it's the only place
 * that knows whether a session exists yet.
 */
export default function AdminLayout({
  children,
  modal,
}: LayoutProps<"/[locale]/admin">) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AuthGuard modal={modal}>{children}</AuthGuard>
    </div>
  );
}
