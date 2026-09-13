"use client";

import {
  AlertTriangle,
  Ban,
  CalendarDays,
  CheckCheck,
  type LucideIcon,
  Repeat,
  UserCheck,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Link, useRouter } from "@/i18n/navigation";
import {
  type AppointmentDetail,
  type AppointmentStatus,
  getAppointmentDetail,
  listAppointments,
} from "@/lib/api/appointments";
import { ApiError } from "@/lib/api/client";
import { onAppointmentChanged } from "@/lib/appointment-events";
import {
  banCustomer,
  type CustomerDetail,
  getCustomer,
  unbanCustomer,
} from "@/lib/api/customers";
import { formatClockTime, formatDate, localDateKey, toIntlLocale } from "@/lib/date";
import { cn } from "@/lib/utils";
import { hasPermission, useSession } from "../../session-context";
import { StatusBadge, statusLabel } from "../../appointments/appointments-view";

/**
 * The customer detail view: ban/unban and appointment history, unchanged
 * regardless of how it's presented. Rendered as a plain page by
 * customers/[id]/page.tsx (direct URL, hard refresh) and as a modal over
 * whatever admin page is currently showing by
 * admin/@modal/(.)customers/[id]/page.tsx (an in-app click) — asModal only
 * changes the outer shell and how "back" is triggered.
 */
export function CustomerDetailContent({ asModal }: { asModal: boolean }) {
  const session = useSession();
  const tc = useTranslations("Common");
  const router = useRouter();

  if (!hasPermission(session, "view_customers")) {
    const noAccess = (
      <p className="text-muted-foreground text-sm">{tc("noAccess")}</p>
    );
    if (!asModal) return noAccess;
    return (
      <Dialog open onOpenChange={(open) => { if (!open) router.back(); }}>
        <DialogContent>{noAccess}</DialogContent>
      </Dialog>
    );
  }

  return <CustomerHistory asModal={asModal} />;
}

function StatTile({
  icon: Icon,
  value,
  label,
  colorClass,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  colorClass: string;
}) {
  return (
    <div className="ring-foreground/10 flex flex-1 items-center gap-3 rounded-xl p-3 ring-1">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${colorClass}`}
      >
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-lg leading-tight font-semibold">{value}</p>
        <p className="text-muted-foreground text-xs leading-tight">{label}</p>
      </div>
    </div>
  );
}

function CustomerHistory({ asModal }: { asModal: boolean }) {
  const t = useTranslations("Customers");
  const ta = useTranslations("Appointments");
  const tc = useTranslations("Common");
  const session = useSession();
  const router = useRouter();
  const locale = toIntlLocale(useLocale());
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [appointments, setAppointments] = useState<AppointmentDetail[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banBusy, setBanBusy] = useState(false);
  const [banError, setBanError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<AppointmentStatus | "">("");
  const [filterServiceId, setFilterServiceId] = useState("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  // Bumped by notifyAppointmentChanged(), fired by the appointment detail
  // modal after a save (a cancellation, most visibly) — that modal is a
  // sibling route segment layered over this page, so this is the only way
  // it can tell this list its data is stale.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(
    () => onAppointmentChanged(() => setRefreshKey((key) => key + 1)),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    getCustomer(id)
      .then((loaded) => {
        if (!cancelled) setCustomer(loaded);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError && err.status === 404
            ? t("notFound")
            : err instanceof ApiError
              ? err.message
              : t("loadErrorDetail"),
        );
      });

    listAppointments({ customerId: id })
      .then((bare) => Promise.all(bare.map((a) => getAppointmentDetail(a.id))))
      .then((details) => {
        if (!cancelled) {
          setAppointments(
            [...details].sort((a, b) =>
              b.start_time.localeCompare(a.start_time),
            ),
          );
        }
      })
      .catch(() => {
        // The customer fetch above already surfaces load failures; a
        // failed history load just leaves the list empty.
      });

    return () => {
      cancelled = true;
    };
  }, [id, refreshKey, t]);

  // The service filter's options come from this customer's own history,
  // not GET /services (admin-only, and would offer services this customer
  // never actually booked).
  const servicesInHistory = useMemo(() => {
    const byId = new Map<string, string>();
    for (const a of appointments ?? []) byId.set(a.service.id, a.service.name);
    return Array.from(byId, ([id, name]) => ({ id, name }));
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    return (appointments ?? []).filter((a) => {
      if (filterStatus && a.status !== filterStatus) return false;
      if (filterServiceId && a.service.id !== filterServiceId) return false;
      const dateKey = localDateKey(a.start_time);
      if (filterStart && dateKey < filterStart) return false;
      if (filterEnd && dateKey > filterEnd) return false;
      return true;
    });
  }, [appointments, filterStatus, filterServiceId, filterStart, filterEnd]);

  const hasActiveFilters =
    filterStatus || filterServiceId || filterStart || filterEnd;

  function openBanDialog() {
    setBanReason("");
    setBanError(null);
    setBanDialogOpen(true);
  }

  async function confirmBan() {
    const reason = banReason.trim();
    if (!reason) return;

    setBanBusy(true);
    setBanError(null);
    try {
      const banned = await banCustomer(id, reason);
      setCustomer((current) => (current ? { ...current, ...banned } : current));
      setBanDialogOpen(false);
    } catch (err) {
      setBanError(err instanceof ApiError ? err.message : t("banError"));
    } finally {
      setBanBusy(false);
    }
  }

  async function handleUnban() {
    setBanBusy(true);
    setBanError(null);
    try {
      const unbanned = await unbanCustomer(id);
      setCustomer((current) =>
        current ? { ...current, ...unbanned } : current,
      );
    } catch (err) {
      setBanError(err instanceof ApiError ? err.message : t("unbanError"));
    } finally {
      setBanBusy(false);
    }
  }

  const canBan = hasPermission(session, "ban_customers");

  const detail = (
    <>
      {error && <p className="text-destructive text-sm">{error}</p>}

      {!error && !customer && (
        <div className="flex justify-center p-6">
          <Spinner className="size-6" />
        </div>
      )}

      {customer && (
        <>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">{customer.name}</h1>
              {customer.banned_at && (
                <Badge variant="destructive">{t("banned")}</Badge>
              )}
            </div>
            {customer.phone && (
              <p className="text-muted-foreground text-sm">
                {customer.phone}
              </p>
            )}
            {customer.email && (
              <p className="text-muted-foreground text-sm">
                {customer.email}
              </p>
            )}
            {customer.missed_appointments_last_30_days > 0 && (
              <p className="text-destructive flex items-center gap-1 text-sm">
                <AlertTriangle className="size-3.5" />
                {t("missedWarning", {
                  count: customer.missed_appointments_last_30_days,
                })}
              </p>
            )}
            {customer.banned_at && customer.ban_reason && (
              <p className="text-muted-foreground text-sm">
                {t("bannedNote", { reason: customer.ban_reason })}
              </p>
            )}

            {!customer.banned_at && (
              <div className="mt-1 flex flex-col gap-1">
                <Link
                  href={`/admin/recurring-appointments?customer_id=${customer.id}&customer_name=${encodeURIComponent(customer.name)}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "self-start",
                  )}
                >
                  <Repeat className="size-3.5" />
                  {t("createRecurringAppointment")}
                </Link>
              </div>
            )}

            {canBan && (
              <div className="mt-1 flex flex-col gap-1">
                {customer.banned_at ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUnban}
                    disabled={banBusy}
                    className="self-start"
                  >
                    {banBusy ? <Spinner /> : <UserCheck className="size-3.5" />}
                    {t("unbanCustomer")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={openBanDialog}
                    className="self-start"
                  >
                    <Ban className="size-3.5" />
                    {t("banCustomer")}
                  </Button>
                )}
                {banError && !banDialogOpen && (
                  <p className="text-destructive text-xs">{banError}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <StatTile
              icon={CalendarDays}
              value={customer.total_appointments}
              label={t("totalAppointments")}
              colorClass="bg-blue-500/10 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400"
            />
            <StatTile
              icon={CheckCheck}
              value={customer.completed_appointments}
              label={t("completedAppointments")}
              colorClass="bg-green-600/10 text-green-700 dark:bg-green-400/10 dark:text-green-400"
            />
            <StatTile
              icon={AlertTriangle}
              value={customer.missed_appointments_all_time}
              label={t("missedAppointmentsAllTime")}
              colorClass="bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400"
            />
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">{t("appointmentHistory")}</h2>

            {appointments && appointments.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  className="w-auto"
                  value={filterStatus}
                  onChange={(event) =>
                    setFilterStatus(event.target.value as AppointmentStatus | "")
                  }
                >
                  <option value="">{ta("anyStatus")}</option>
                  <option value="CONFIRMED">{statusLabel("CONFIRMED", ta)}</option>
                  <option value="COMPLETED">{statusLabel("COMPLETED", ta)}</option>
                  <option value="CANCELLED">{statusLabel("CANCELLED", ta)}</option>
                  <option value="MISSED">{statusLabel("MISSED", ta)}</option>
                </Select>
                {servicesInHistory.length > 1 && (
                  <Select
                    className="w-auto"
                    value={filterServiceId}
                    onChange={(event) => setFilterServiceId(event.target.value)}
                  >
                    <option value="">{t("anyService")}</option>
                    {servicesInHistory.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </Select>
                )}
                <Input
                  type="date"
                  className="w-auto"
                  value={filterStart}
                  onChange={(event) => setFilterStart(event.target.value)}
                />
                <Input
                  type="date"
                  className="w-auto"
                  value={filterEnd}
                  onChange={(event) => setFilterEnd(event.target.value)}
                />
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterStatus("");
                      setFilterServiceId("");
                      setFilterStart("");
                      setFilterEnd("");
                    }}
                    className="text-muted-foreground text-xs underline"
                  >
                    {t("clearFilters")}
                  </button>
                )}
              </div>
            )}

            {appointments && appointments.length === 0 && (
              <p className="text-muted-foreground text-sm">
                {t("noAppointments")}
              </p>
            )}
            {appointments &&
              appointments.length > 0 &&
              filteredAppointments.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  {t("noAppointmentsFiltered")}
                </p>
              )}
            {!appointments && (
              <div className="flex justify-center p-6">
                <Spinner className="size-6" />
              </div>
            )}
            {filteredAppointments.map((appointment) => (
              <Link
                key={appointment.id}
                href={`/admin/appointments/${appointment.id}`}
                className="block"
              >
                <Card size="sm" className="hover:bg-muted/50 transition-colors">
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {formatDate(localDateKey(appointment.start_time), locale)}{" "}
                        · {formatClockTime(appointment.start_time, locale)}
                      </p>
                      <p className="text-muted-foreground break-words">
                        {appointment.service.name} · {appointment.employee.name}
                      </p>
                    </div>
                    <StatusBadge status={appointment.status} t={ta} />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );

  return (
    <>
      {asModal ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) router.back();
          }}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            {detail}
          </DialogContent>
        </Dialog>
      ) : (
        <div className="flex max-w-lg flex-col gap-6">
          <Link href="/admin/customers" className="text-sm underline">
            {t("backToCustomers")}
          </Link>
          {detail}
        </div>
      )}

      {customer && (
        <Dialog
          open={banDialogOpen}
          onOpenChange={(open) => {
            setBanDialogOpen(open);
            if (!open) setBanError(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ban className="text-destructive size-4" />
                {t("banCustomer")}
              </DialogTitle>
              <DialogDescription>
                {t("banDialogDescription", { name: customer.name })}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1">
              <label htmlFor="ban-reason" className="text-sm font-medium">
                {t("banReason")}
              </label>
              <Input
                id="ban-reason"
                value={banReason}
                onChange={(event) => setBanReason(event.target.value)}
                placeholder={t("banReasonPlaceholder")}
                autoFocus
              />
              {banError && (
                <p className="text-destructive text-xs">{banError}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBanDialogOpen(false)}
              >
                {tc("cancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={confirmBan}
                disabled={banBusy || !banReason.trim()}
              >
                {banBusy && <Spinner />}
                {t("banCustomer")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
