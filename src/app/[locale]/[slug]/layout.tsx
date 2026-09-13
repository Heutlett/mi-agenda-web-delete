/**
 * Shared shell for the public, no-auth booking site at /:slug: a single
 * centered card on a neutral background, mobile-first even on desktop.
 *
 * No language switcher here: the page's language follows the business's
 * own `language` setting (enforced server-side in page.tsx's own
 * redirect) — a customer never chooses it, only that business's admin can,
 * the same reasoning the admin dashboard's own top bar now follows.
 */
export default function BusinessBookingLayout({
  children,
}: LayoutProps<"/[locale]/[slug]">) {
  return (
    <div className="bg-muted/40 flex flex-1 justify-center px-4 py-8">
      <div className="flex w-full max-w-md flex-col gap-2">
        <div className="bg-card text-card-foreground rounded-2xl border shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
