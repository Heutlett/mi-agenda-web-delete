"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { updateBusinessPriceVisibility } from "@/lib/api/business";
import { ApiError } from "@/lib/api/client";
import { useBusinessSettings } from "../business-context";
import { hasPermission, useSession } from "../session-context";

/**
 * Personal settings for the signed-in user, as opposed to the shared
 * Business page: anything here is either about the individual (profile
 * info) or a capability granted to that individual specifically (like
 * manage_price_visibility), even when its effect is business-wide — a
 * permission granted to one employee shouldn't require giving them access
 * to a page that configures the rest of the business for everyone else.
 */
export default function ProfilePage() {
  const t = useTranslations("Profile");
  const session = useSession();

  return (
    <div className="flex max-w-md flex-col gap-6">
      <h1 className="text-lg font-semibold">{t("title")}</h1>

      <section className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">{t("profileInfoTitle")}</h2>
        <p className="text-sm">{session.name}</p>
        <p className="text-muted-foreground text-xs">
          {t("profileInfoPlaceholder")}
        </p>
      </section>

      {hasPermission(session, "manage_price_visibility") && (
        <section>
          <PriceVisibilityToggle />
        </section>
      )}
    </div>
  );
}

/**
 * PATCH /businesses/{id}/price-visibility is a separate endpoint from the
 * general business settings PATCH, specifically so it can be reached by an
 * employee with manage_price_visibility without exposing every other
 * business setting to them.
 */
function PriceVisibilityToggle() {
  const t = useTranslations("Profile");
  const tc = useTranslations("Common");
  const { business, setBusiness } = useBusinessSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!business) return null;

  async function setShowPrices(next: boolean) {
    if (!business || next === business.show_service_prices) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await updateBusinessPriceVisibility(business.id, next);
      setBusiness(updated);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : tc("genericErrorRetry"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{t("showServicePrices")}</span>
      <p className="text-muted-foreground text-xs">
        {t("showServicePricesHint")}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={business.show_service_prices ? "default" : "outline"}
          size="sm"
          disabled={busy}
          onClick={() => setShowPrices(true)}
        >
          {t("showServicePricesOn")}
        </Button>
        <Button
          type="button"
          variant={!business.show_service_prices ? "default" : "outline"}
          size="sm"
          disabled={busy}
          onClick={() => setShowPrices(false)}
        >
          {t("showServicePricesOff")}
        </Button>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
