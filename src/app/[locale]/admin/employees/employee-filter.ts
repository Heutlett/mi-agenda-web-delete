import type { Employee } from "@/lib/api/employees";

/**
 * GET /employees has no server-side search/sort — it always returns every
 * non-deleted employee — so both are applied client-side. Fine at the
 * scale a single business's staff reaches.
 */
export function filterEmployees(employees: Employee[], query: string): Employee[] {
  const q = query.trim().toLowerCase();
  if (!q) return employees;
  return employees.filter((employee) => employee.name.toLowerCase().includes(q));
}

export type SortColumn = "name";
export type SortDirection = "asc" | "desc";

export interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

export function sortEmployees(
  employees: Employee[],
  sort: SortState,
): Employee[] {
  const sorted = [...employees].sort((a, b) => {
    switch (sort.column) {
      case "name":
        return a.name.localeCompare(b.name);
    }
  });

  return sort.direction === "asc" ? sorted : sorted.reverse();
}
