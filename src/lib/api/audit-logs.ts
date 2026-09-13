import { authFetch } from "@/lib/auth/session";

export type AuditActorType = "user" | "public";

/**
 * One row from GET /audit-logs. entity_id is null only in a defensive edge
 * case the backend never actually produces yet; actor_user_id/actor_name/
 * actor_role are null exactly when actor_type is "public" — an anonymous
 * request (a customer's own booking, a business signup), not a staff
 * action.
 */
export interface AuditLogEntry {
  id: string;
  business_id: string;
  actor_type: AuditActorType;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_role: "admin" | "employee" | null;
  /** "entity_type.verb", e.g. "employee.update". */
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  /** Structured detail whose shape varies by entity_type — old/new diffs, related names, cascade counts. */
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface ListAuditLogsParams {
  entityType?: string;
  action?: string;
  actorType?: AuditActorType;
  actorUserId?: string;
  /** Calendar date in the business's own timezone, "YYYY-MM-DD". */
  startDate?: string;
  /** Calendar date in the business's own timezone, "YYYY-MM-DD". */
  endDate?: string;
  /** Default 50, max 200. */
  limit?: number;
  offset?: number;
}

export interface ListAuditLogsResult {
  items: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

/** GET /audit-logs — admin-only. Newest first; see ListAuditLogsParams for filters. */
export function listAuditLogs(
  params: ListAuditLogsParams = {},
): Promise<ListAuditLogsResult> {
  return authFetch<ListAuditLogsResult>("/audit-logs", {
    params: {
      entity_type: params.entityType,
      action: params.action,
      actor_type: params.actorType,
      actor_user_id: params.actorUserId,
      start_date: params.startDate,
      end_date: params.endDate,
      limit: params.limit,
      offset: params.offset,
    },
  });
}
