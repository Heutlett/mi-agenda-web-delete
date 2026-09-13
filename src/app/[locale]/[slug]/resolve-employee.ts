import type { PublicEmployee } from "@/lib/api/business";

/** The `employee` query param value that means "show every professional's combined availability" — see resolveEmployee. */
export const ANY_EMPLOYEE_ID = "any";

export type ResolvedEmployee = PublicEmployee | "pending" | "none" | "all";

/**
 * A single active employee is auto-selected and the picker step is skipped,
 * matching the "minimal steps" pattern observed on the zeeg.me UX reference
 * — "all" wouldn't mean anything extra when there's only one option anyway.
 * With two or more, an explicit `employeeId` of ANY_EMPLOYEE_ID means the
 * customer chose to see everyone's combined availability instead of picking
 * one up front; a matching real id resolves to that employee; anything else
 * (including no id at all) shows the picker step ("pending"). Zero
 * employees means the business can't be booked ("none").
 */
export function resolveEmployee(
  employees: PublicEmployee[],
  employeeId: string | undefined,
): ResolvedEmployee {
  if (employees.length === 0) return "none";
  if (employees.length === 1) return employees[0];
  if (employeeId === ANY_EMPLOYEE_ID) return "all";
  const match = employeeId
    ? employees.find((e) => e.id === employeeId)
    : undefined;
  return match ?? "pending";
}
