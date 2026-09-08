"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("Booking");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 p-6 text-center">
      <div className="space-y-1">
        <p className="font-semibold">{t("errorTitle")}</p>
        <p className="text-muted-foreground text-sm">{t("errorBody")}</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => retry()}>
        {t("tryAgain")}
      </Button>
    </div>
  );
}
