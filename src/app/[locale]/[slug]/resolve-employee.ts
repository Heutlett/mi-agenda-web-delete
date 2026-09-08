import type { PublicEmployee } from "@/lib/api/business";

export type ResolvedEmployee = PublicEmployee | "pending" | "none";

/**
 * A single active employee is auto-selected and the picker step is skipped,
 * matching the "minimal steps" pattern observed on the zeeg.me UX reference.
 * Multiple employees require an explicit, valid `employeeId` match, or the
 * picker step ("pending") is shown. Zero employees means the business can't
 * be booked ("none").
 */
export function resolveEmployee(
  employees: PublicEmployee[],
  employeeId: string | undefined,
): ResolvedEmployee {
  if (employees.length === 0) return "none";
  if (employees.length === 1) return employees[0];
  const match = employeeId
    ? employees.find((e) => e.id === employeeId)
    : undefined;
  return match ?? "pending";
}
