import { redirect } from "@/i18n/navigation";

/**
 * The bare /admin URL has no content of its own: both an admin and an
 * employee land on their calendar (see admin-nav.tsx's "My Calendar" item)
 * as the actual entry point after logging in.
 */
export default async function AdminHomePage({
  params,
}: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  redirect({ href: "/admin/appointments", locale });
}
