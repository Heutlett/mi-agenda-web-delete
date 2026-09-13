"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  type AuditActorType,
  type AuditLogEntry,
  listAuditLogs,
} from "@/lib/api/audit-logs";
import { ApiError } from "@/lib/api/client";
import { type User, listUsers } from "@/lib/api/users";
import { formatDateTime, toIntlLocale } from "@/lib/date";
import { useSession } from "../session-context";

// Mirrors the entity_type values internal/audit's call sites actually use
// in mi-agenda-api — see docs/design/architecture.md's "Audit log" section
// there. Kept in sync by hand, the same way this repo already keeps a few
// other cross-repo constants (e.g. supported languages) in sync.
const ENTITY_TYPES = [
  "appointment",
  "recurring_appointment",
  "employee",
  "service",
  "schedule",
  "lunch_skip",
  "availability_block",
  "customer",
  "business",
  "user",
  "reminder_offset",
] as const;

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const session = useSession();
  const tc = useTranslations("Common");

  if (session.role !== "admin") {
    return <p className="text-muted-foreground text-sm">{tc("noAccess")}</p>;
  }

  return <AuditLogManagement />;
}

function AuditLogManagement() {
  const t = useTranslations("AuditLog");
  const locale = toIntlLocale(useLocale());
  const [entityType, setEntityType] = useState("");
  const [actorType, setActorType] = useState<AuditActorType | "">("");
  const [actorUserId, setActorUserId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [offset, setOffset] = useState(0);
  const [users, setUsers] = useState<User[] | null>(null);

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch(() => {
        // The actor filter is a convenience; if it fails to load, the log
        // still works unfiltered.
      });
  }, []);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-lg font-semibold">{t("title")}</h1>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          className="w-auto"
          value={entityType}
          onChange={(event) => {
            setEntityType(event.target.value);
            setOffset(0);
          }}
        >
          <option value="">{t("anyEntityType")}</option>
          {ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`entityType_${type}`)}
            </option>
          ))}
        </Select>

        <Select
          className="w-auto"
          value={actorType}
          onChange={(event) => {
            setActorType(event.target.value as AuditActorType | "");
            setOffset(0);
          }}
        >
          <option value="">{t("anyActorType")}</option>
          <option value="user">{t("actorTypeUser")}</option>
          <option value="public">{t("actorTypePublic")}</option>
        </Select>

        {users && users.length > 0 && (
          <Select
            className="w-auto"
            value={actorUserId}
            onChange={(event) => {
              setActorUserId(event.target.value);
              setOffset(0);
            }}
          >
            <option value="">{t("anyActor")}</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
        )}

        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(event) => {
              setStartDate(event.target.value);
              setOffset(0);
            }}
            className="w-auto"
          />
          <span className="text-muted-foreground text-sm">–</span>
          <Input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => {
              setEndDate(event.target.value);
              setOffset(0);
            }}
            className="w-auto"
          />
        </div>
      </div>

      <AuditLogList
        key={`${entityType}:${actorType}:${actorUserId}:${startDate}:${endDate}:${offset}`}
        entityType={entityType}
        actorType={actorType}
        actorUserId={actorUserId}
        startDate={startDate}
        endDate={endDate}
        offset={offset}
        onOffsetChange={setOffset}
        locale={locale}
      />
    </div>
  );
}

function AuditLogList({
  entityType,
  actorType,
  actorUserId,
  startDate,
  endDate,
  offset,
  onOffsetChange,
  locale,
}: {
  entityType: string;
  actorType: AuditActorType | "";
  actorUserId: string;
  startDate: string;
  endDate: string;
  offset: number;
  onOffsetChange: (offset: number) => void;
  locale: string;
}) {
  const t = useTranslations("AuditLog");
  const [items, setItems] = useState<AuditLogEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listAuditLogs({
      entityType: entityType || undefined,
      actorType: actorType || undefined,
      actorUserId: actorUserId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      limit: PAGE_SIZE,
      offset,
    })
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.total);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : t("loadError"));
      });

    return () => {
      cancelled = true;
    };
  }, [entityType, actorType, actorUserId, startDate, endDate, offset, t]);

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  if (items === null) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("none")}</p>;
  }

  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + items.length, total);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {items.map((entry) => (
          <AuditLogRow key={entry.id} entry={entry} locale={locale} />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {t("rangeSummary", { start: rangeStart, end: rangeEnd, total })}
        </p>
        <div className="flex gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => onOffsetChange(Math.max(0, offset - PAGE_SIZE))}
          >
            {t("previousPage")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={offset + items.length >= total}
            onClick={() => onOffsetChange(offset + PAGE_SIZE)}
          >
            {t("nextPage")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AuditLogRow({
  entry,
  locale,
}: {
  entry: AuditLogEntry;
  locale: string;
}) {
  const t = useTranslations("AuditLog");
  const hasMetadata = Object.keys(entry.metadata).length > 0;

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1.5 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            {formatDateTime(entry.created_at, locale)}
          </p>
          {entry.actor_type === "public" ? (
            <Badge variant="warning">{t("actorTypePublic")}</Badge>
          ) : (
            <Badge variant="info">
              {entry.actor_role === "admin"
                ? t("actorTypeAdmin")
                : t("actorTypeEmployee")}
            </Badge>
          )}
        </div>
        <p>{entry.summary}</p>
        {hasMetadata && (
          <details className="text-muted-foreground text-xs">
            <summary className="cursor-pointer select-none">
              {t("showDetails")}
            </summary>
            <pre className="mt-1.5 overflow-x-auto rounded-lg bg-muted p-2">
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
