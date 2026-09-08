import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";

export default function Home() {
  const t = useTranslations("Home");
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex justify-end p-4">
        <Suspense fallback={null}>
          <LanguageSwitcher />
        </Suspense>
      </div>
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <p className="text-muted-foreground text-sm">{t("tagline")}</p>
      </div>
    </div>
  );
}
