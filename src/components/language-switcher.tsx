"use client";

import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import type { ChangeEvent } from "react";

import { Select } from "@/components/ui/select";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LOCALE_LABELS: Record<string, string> = {
  es: "Español",
  en: "English",
};

/** Switches the active locale while staying on the same page, query params included. */
export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value;
    const query = searchParams.toString();
    router.replace(
      { pathname, query: query ? Object.fromEntries(searchParams) : undefined },
      { locale: nextLocale },
    );
  }

  return (
    <Select
      aria-label="Language"
      className="w-auto"
      value={locale}
      onChange={handleChange}
    >
      {routing.locales.map((value) => (
        <option key={value} value={value}>
          {LOCALE_LABELS[value] ?? value}
        </option>
      ))}
    </Select>
  );
}
