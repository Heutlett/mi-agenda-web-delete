import { Suspense } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";

/**
 * Shared shell for the public, no-auth booking site at /:slug: a single
 * centered card on a neutral background, mobile-first even on desktop.
 */
export default function BusinessBookingLayout({
  children,
}: LayoutProps<"/[locale]/[slug]">) {
  return (
    <div className="bg-muted/40 flex flex-1 justify-center px-4 py-8">
      <div className="flex w-full max-w-md flex-col gap-2">
        <div className="flex justify-end">
          <Suspense fallback={null}>
            <LanguageSwitcher />
          </Suspense>
        </div>
        <div className="bg-card text-card-foreground rounded-2xl border shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
