import { defineRouting } from "next-intl/routing";

/**
 * Spanish is the default: the initial target market is Costa Rican
 * businesses and their customers. English stays fully supported.
 */
export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
});
