import { authFetch } from "@/lib/auth/session";

export interface AvailabilityBlock {
  id: string;
  business_id: string;
  employee_id: string;
  /** RFC 3339 timestamp. */
  start_time: string;
  /** RFC 3339 timestamp. */
  end_time: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAvailabilityBlockParams {
  employee_id: string;
  start_time: string;
  end_time: string;
  reason?: string;
}

/** POST /availability/blocks — adds a one-off unavailable period (vacation, break, closure) for an employee. Requires the admin role. */
export function createAvailabilityBlock(
  params: CreateAvailabilityBlockParams,
): Promise<AvailabilityBlock> {
  return authFetch<AvailabilityBlock>("/availability/blocks", {
    method: "POST",
    body: params,
  });
}

/** GET /availability/blocks — lists blocks in the caller's own business, optionally filtered to one employee. Requires the admin role. */
export function listAvailabilityBlocks(
  employeeId?: string,
): Promise<AvailabilityBlock[]> {
  return authFetch<AvailabilityBlock[]>("/availability/blocks", {
    params: employeeId ? { employee_id: employeeId } : undefined,
  });
}

export interface UpdateAvailabilityBlockParams {
  start_time: string;
  end_time: string;
  reason?: string;
}

/** PATCH /availability/blocks/{id} — replaces the block's start/end time and reason. Any authenticated role, self-scoped for an employee. */
export function updateAvailabilityBlock(
  id: string,
  params: UpdateAvailabilityBlockParams,
): Promise<AvailabilityBlock> {
  return authFetch<AvailabilityBlock>(
    `/availability/blocks/${encodeURIComponent(id)}`,
    { method: "PATCH", body: params },
  );
}

/** DELETE /availability/blocks/{id} — permanently removes the block. Requires the admin role. */
export function deleteAvailabilityBlock(id: string): Promise<void> {
  return authFetch<void>(`/availability/blocks/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
