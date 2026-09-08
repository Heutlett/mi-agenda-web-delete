import { useTranslations } from "next-intl";

export default function BusinessNotFound() {
  const t = useTranslations("Booking");

  return (
    <div className="p-6 text-center">
      <p className="font-semibold">{t("notFoundTitle")}</p>
      <p className="text-muted-foreground mt-1 text-sm">{t("notFoundBody")}</p>
    </div>
  );
}
