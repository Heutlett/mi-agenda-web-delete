"use client";

import { AlertTriangle, Ban } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
import { type Customer, listCustomers } from "@/lib/api/customers";
import { hasPermission, useSession } from "../session-context";

export default function CustomersPage() {
  const session = useSession();
  const tc = useTranslations("Common");

  if (!hasPermission(session, "view_customers")) {
    return <p className="text-muted-foreground text-sm">{tc("noAccess")}</p>;
  }

  return <CustomerSearch />;
}

function CustomerSearch() {
  const t = useTranslations("Customers");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [bannedOnly, setBannedOnly] = useState(false);
  const [missedOnly, setMissedOnly] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <Input
        type="search"
        placeholder={t("searchPlaceholder")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          variant={bannedOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setBannedOnly((v) => !v)}
        >
          <Ban className="size-3.5" />
          {t("filterBanned")}
        </Button>
        <Button
          type="button"
          variant={missedOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setMissedOnly((v) => !v)}
        >
          <AlertTriangle className="size-3.5" />
          {t("filterMissed")}
        </Button>
      </div>
      <CustomerResults
        key={debouncedQuery}
        query={debouncedQuery}
        bannedOnly={bannedOnly}
        missedOnly={missedOnly}
      />
    </div>
  );
}

function CustomerResults({
  query,
  bannedOnly,
  missedOnly,
}: {
  query: string;
  bannedOnly: boolean;
  missedOnly: boolean;
}) {
  const t = useTranslations("Customers");
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listCustomers(query || undefined)
      .then((loaded) => {
        if (!cancelled) setCustomers(loaded);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : t("loadError"));
      });

    return () => {
      cancelled = true;
    };
  }, [query, t]);

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  if (!customers) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  const filtered = customers.filter(
    (customer) =>
      (!bannedOnly || customer.banned_at) &&
      (!missedOnly || customer.missed_appointments_last_30_days > 0),
  );

  if (filtered.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {query || bannedOnly || missedOnly ? t("noneMatch") : t("noneYet")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {filtered.map((customer) => (
        <Link
          key={customer.id}
          href={`/admin/customers/${customer.id}`}
          className="block"
        >
          <Card size="sm" className="hover:bg-muted/50 transition-colors">
            <CardContent className="flex flex-col gap-0.5 text-sm">
              <div className="flex items-center gap-2">
                <p className="font-medium">{customer.name}</p>
                {customer.banned_at && (
                  <Badge variant="destructive">{t("banned")}</Badge>
                )}
              </div>
              {customer.phone && (
                <p className="text-muted-foreground">{customer.phone}</p>
              )}
              {customer.email && (
                <p className="text-muted-foreground">{customer.email}</p>
              )}
              {customer.missed_appointments_last_30_days > 0 && (
                <p className="text-destructive flex items-center gap-1">
                  <AlertTriangle className="size-3.5" />
                  {t("missedWarning", {
                    count: customer.missed_appointments_last_30_days,
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
