import type { Service } from "@/lib/api/services";

/**
 * GET /services has no server-side search/sort — it always returns every
 * non-deleted service — so both are applied client-side. Fine at the
 * scale a single business's catalog reaches.
 */
export function filterServices(services: Service[], query: string): Service[] {
  const q = query.trim().toLowerCase();
  if (!q) return services;
  return services.filter((service) => service.name.toLowerCase().includes(q));
}

export type SortColumn = "name" | "duration_minutes" | "price";
export type SortDirection = "asc" | "desc";

export interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

export function sortServices(
  services: Service[],
  sort: SortState,
): Service[] {
  const sorted = [...services].sort((a, b) => {
    switch (sort.column) {
      case "name":
        return a.name.localeCompare(b.name);
      case "duration_minutes":
        return a.duration_minutes - b.duration_minutes;
      case "price":
        return a.price - b.price;
    }
  });

  return sort.direction === "asc" ? sorted : sorted.reverse();
}
