"use client";

import { Pencil, Repeat } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import {
  type Customer,
  listCustomers,
} from "@/lib/api/customers";
import { type Employee, getCurrentEmployee, listEmployees } from "@/lib/api/employees";
import {
  createRecurringAppointment,
  listRecurringAppointments,
  type PreviewOccurrence,
  previewRecurringAppointment,
  type RecurringAppointment,
  updateRecurringAppointment,
} from "@/lib/api/recurring-appointments";
import { type Schedule, listSchedules } from "@/lib/api/schedules";
import { type Service, listServices } from "@/lib/api/services";
import { formatDate } from "@/lib/date";
import { employeeHasActiveSchedule } from "@/lib/schedule-check";
import { dayNames } from "../schedules/schedule-form";
import { hasPermission, useSession } from "../session-context";

function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

/** Adds one year to a "YYYY-MM-DD" date string — the backend's own cap on how far end_date can sit past start_date. */
function addOneYear(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y + 1, m - 1, d)).toISOString().slice(0, 10);
}

// Any authenticated role reaches this page, the same self-scoping
// POST/GET/PATCH /recurring-appointments itself uses — no permission
// gate, matching POST /appointments/walk-in's own reasoning (an employee
// setting up a regular customer's standing booking is the same kind of
// trust walk-in booking already extends).
export default function RecurringAppointmentsPage() {
  return <RecurringAppointmentsManagement />;
}

function RecurringAppointmentsManagement() {
  const t = useTranslations("RecurringAppointments");
  const tc = useTranslations("Common");
  const session = useSession();
  const isAdmin = session.role === "admin";
  const searchParams = useSearchParams();
  const presetCustomerId = searchParams.get("customer_id") ?? undefined;
  const presetCustomerName = searchParams.get("customer_name") ?? undefined;

  const [employees, setEmployees] = useState<Employee[] | null>(
    isAdmin ? null : [],
  );
  const [ownEmployeeId, setOwnEmployeeId] = useState<string | null>(null);
  const [services, setServices] = useState<Service[] | null>(null);
  const [rules, setRules] = useState<RecurringAppointment[] | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(!!presetCustomerId);
  // Bumped every time the dialog opens and used as its key, forcing a
  // fresh mount instead of resetting form state in an effect — the same
  // approach the walk-in dialog (appointments-view.tsx) uses.
  const [createInstance, setCreateInstance] = useState(0);

  function openCreateDialog() {
    setCreateInstance((n) => n + 1);
    setCreateOpen(true);
  }

  useEffect(() => {
    listServices()
      .then(setServices)
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : t("loadError"));
      });

    if (isAdmin) {
      listEmployees()
        .then(setEmployees)
        .catch((err: unknown) => {
          setLoadError(err instanceof ApiError ? err.message : t("loadError"));
        });
    } else {
      getCurrentEmployee()
        .then((employee) => setOwnEmployeeId(employee.id))
        .catch((err: unknown) => {
          setLoadError(err instanceof ApiError ? err.message : t("loadError"));
        });
    }
  }, [isAdmin, t]);

  const reload = useCallback(() => {
    listRecurringAppointments({
      employeeId: isAdmin && employeeFilter ? employeeFilter : undefined,
      status: showInactive ? "all" : "active",
    })
      .then(setRules)
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : t("loadError"));
      });
  }, [isAdmin, employeeFilter, showInactive, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Both directions cancel or recreate the rule's own pending occurrences
  // (see CancelFutureOccurrences/RegenerateFutureOccurrences on the
  // backend) — worth confirming first either way, rather than acting on
  // one click.
  const [statusChangeRule, setStatusChangeRule] =
    useState<RecurringAppointment | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);

  function handleToggleStatus(rule: RecurringAppointment) {
    setStatusChangeRule(rule);
  }

  async function performStatusChange() {
    if (!statusChangeRule) return;
    setChangingStatus(true);
    try {
      await updateRecurringAppointment(statusChangeRule.id, {
        status: statusChangeRule.status === "active" ? "inactive" : "active",
      });
      setStatusChangeRule(null);
      reload();
    } catch {
      // The dialog stays open so the admin can just try again; the list
      // itself isn't in an error state over one failed toggle.
    } finally {
      setChangingStatus(false);
    }
  }

  const [editingRule, setEditingRule] = useState<RecurringAppointment | null>(null);

  const ready = services !== null && (!isAdmin || employees !== null);

  if (loadError) {
    return <p className="text-destructive text-sm">{loadError}</p>;
  }

  if (!ready) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (isAdmin && employees && employees.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("addEmployeeFirst")}</p>;
  }

  if (services && services.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("addServiceFirst")}</p>;
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <Button type="button" size="sm" onClick={openCreateDialog}>
          {t("newRule")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isAdmin && employees && employees.length > 0 && (
          <Select
            className="w-auto"
            value={employeeFilter}
            onChange={(event) => setEmployeeFilter(event.target.value)}
          >
            <option value="">{t("anyEmployee")}</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </Select>
        )}
        <Button
          type="button"
          variant={showInactive ? "default" : "outline"}
          size="sm"
          onClick={() => setShowInactive((v) => !v)}
        >
          {showInactive ? t("hideInactive") : t("showInactive")}
        </Button>
      </div>

      <RuleList
        rules={rules}
        onToggleStatus={handleToggleStatus}
        onEdit={setEditingRule}
      />

      <CreateRecurringAppointmentDialog
        key={createInstance}
        open={createOpen}
        onOpenChange={setCreateOpen}
        isAdmin={isAdmin}
        employees={employees ?? []}
        ownEmployeeId={ownEmployeeId}
        services={services ?? []}
        presetCustomerId={presetCustomerId}
        presetCustomerName={presetCustomerName}
        onCreated={reload}
      />

      <EditRecurringAppointmentDialog
        key={editingRule?.id}
        rule={editingRule}
        services={services ?? []}
        onOpenChange={(open) => {
          if (!open) setEditingRule(null);
        }}
        onSaved={reload}
      />

      <Dialog
        open={!!statusChangeRule}
        onOpenChange={(open) => {
          if (!open && !changingStatus) setStatusChangeRule(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {statusChangeRule?.status === "active"
                ? t("confirmDeactivateTitle")
                : t("confirmActivateTitle")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {statusChangeRule?.status === "active"
              ? t("confirmDeactivateWarning")
              : t("confirmActivateWarning")}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStatusChangeRule(null)}
              disabled={changingStatus}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              variant={statusChangeRule?.status === "active" ? "destructive" : "default"}
              size="sm"
              onClick={performStatusChange}
              disabled={changingStatus}
            >
              {changingStatus && <Spinner />}
              {changingStatus
                ? tc("saving")
                : statusChangeRule?.status === "active"
                  ? t("deactivate")
                  : t("activate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RuleList({
  rules,
  onToggleStatus,
  onEdit,
}: {
  rules: RecurringAppointment[] | null;
  onToggleStatus: (rule: RecurringAppointment) => void;
  onEdit: (rule: RecurringAppointment) => void;
}) {
  const t = useTranslations("RecurringAppointments");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const days = dayNames(locale);

  if (!rules) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (rules.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("none")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {rules.map((rule) => (
        <Card key={rule.id} size="sm">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <Repeat className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">{rule.customer_name}</p>
                <p className="text-muted-foreground break-words">
                  {rule.service_name} · {rule.employee_name}
                </p>
                <p className="text-muted-foreground">
                  {t("scheduleSummary", {
                    day: days[rule.day_of_week],
                    time: rule.start_time,
                    weeks: rule.interval_weeks,
                  })}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t("dateRange", {
                    start: formatDate(rule.start_date, locale),
                    end: formatDate(rule.end_date, locale),
                  })}
                </p>
                {rule.expired && (
                  <p className="text-amber-600 dark:text-amber-500 text-xs">
                    {t("expiredNote", { date: formatDate(rule.end_date, locale) })}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge variant={rule.status === "active" ? "success" : "secondary"}>
                {rule.status === "active" ? t("active") : t("inactive")}
              </Badge>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(rule)}
                >
                  <Pencil className="size-3.5" />
                  {tc("edit")}
                </Button>
                {/* Toggling status on an expired rule wouldn't visibly change
                    anything — expired always reads as inactive regardless of
                    the stored value — so it's hidden in favor of Edit, which
                    is also how end_date (and so expiration) gets fixed. */}
                {!rule.expired && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onToggleStatus(rule)}
                  >
                    {rule.status === "active" ? t("deactivate") : t("activate")}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CreateRecurringAppointmentDialog({
  open,
  onOpenChange,
  isAdmin,
  employees,
  ownEmployeeId,
  services,
  presetCustomerId,
  presetCustomerName,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  employees: Employee[];
  ownEmployeeId: string | null;
  services: Service[];
  presetCustomerId?: string;
  presetCustomerName?: string;
  onCreated: () => void;
}) {
  const t = useTranslations("RecurringAppointments");
  const tc = useTranslations("Common");
  const session = useSession();
  const locale = useLocale();
  const days = dayNames(locale);

  const [customerId, setCustomerId] = useState(presetCustomerId ?? "");
  const [customerName, setCustomerName] = useState(presetCustomerName ?? "");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[] | null>(
    null,
  );
  const [employeeId, setEmployeeId] = useState(
    isAdmin ? (employees[0]?.id ?? "") : "",
  );
  const [serviceId, setServiceId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("");
  const [intervalWeeks, setIntervalWeeks] = useState("1");
  const [startDate, setStartDate] = useState(todayLocal());
  const [endDate, setEndDate] = useState(addOneYear(todayLocal()));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewOccurrence[] | null>(null);
  // Fetched once the target employee resolves, purely to fail fast if
  // they have no working hours at all — null while loading (or before an
  // employee is resolved), during which nothing is warned about yet.
  const [employeeSchedules, setEmployeeSchedules] = useState<Schedule[] | null>(
    null,
  );

  const effectiveEmployeeId = isAdmin ? employeeId : ownEmployeeId;
  const employeeHasNoSchedule =
    employeeSchedules !== null && !employeeHasActiveSchedule(employeeSchedules);
  const canSearchCustomers = hasPermission(session, "view_customers");
  const trimmedQuery = customerQuery.trim();

  // Clears any previous employee's loaded schedules the moment the
  // effective employee changes, during the same render that notices the
  // change, rather than as a setState inside the effect below.
  const [loadedScheduleFor, setLoadedScheduleFor] = useState(effectiveEmployeeId);
  if (loadedScheduleFor !== effectiveEmployeeId) {
    setLoadedScheduleFor(effectiveEmployeeId);
    setEmployeeSchedules(null);
  }

  useEffect(() => {
    if (!effectiveEmployeeId) return;
    let cancelled = false;
    listSchedules(effectiveEmployeeId)
      .then((result) => {
        if (!cancelled) setEmployeeSchedules(result);
      })
      .catch(() => {
        // No warning shown if this fails; the preview step below still
        // catches the practical consequence.
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveEmployeeId]);

  // No reset-on-open effect: RecurringAppointmentsManagement remounts this
  // component fresh each time the dialog opens (see its own `key` prop),
  // the same way the walk-in dialog handles it, so every useState above
  // already starts from its initial value on open.

  useEffect(() => {
    if (!canSearchCustomers || presetCustomerId || trimmedQuery.length < 2) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      listCustomers(trimmedQuery)
        .then((results) => {
          if (!cancelled) setCustomerResults(results);
        })
        .catch(() => {
          if (!cancelled) setCustomerResults([]);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [trimmedQuery, canSearchCustomers, presetCustomerId]);

  // Results from a now-shrunk query would otherwise flash stale matches;
  // gating display on the same length threshold that triggers a fetch
  // avoids needing a separate reset in the effect above.
  const showCustomerResults = trimmedQuery.length >= 2 ? customerResults : null;

  const availableServices = services.filter(
    (service) =>
      !effectiveEmployeeId || service.employee_ids.includes(effectiveEmployeeId),
  );

  function buildParams() {
    return {
      customerId,
      ...(isAdmin && effectiveEmployeeId ? { employeeId: effectiveEmployeeId } : {}),
      serviceId,
      dayOfWeek: Number(dayOfWeek),
      startTime,
      intervalWeeks: Number(intervalWeeks) || 1,
      startDate,
      endDate,
    };
  }

  // Previews first — rather than creating directly — so any date that
  // would silently get skipped for a conflict (see previewRecurringAppointment)
  // shows up as a warning the admin can see and act on before anything is
  // actually booked, not discover afterward as a gap in the series.
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (
      !customerId ||
      !effectiveEmployeeId ||
      !serviceId ||
      !startTime ||
      !startDate ||
      !endDate
    ) {
      setError(t("missingFieldsError"));
      return;
    }

    setPreviewing(true);
    setError(null);
    try {
      const results = await previewRecurringAppointment(buildParams());
      setPreview(results);
      setConfirmOpen(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("createError"));
    } finally {
      setPreviewing(false);
    }
  }

  async function performCreate() {
    setSubmitting(true);
    setError(null);
    try {
      await createRecurringAppointment(buildParams());
      onCreated();
      setConfirmOpen(false);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("createError"));
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  const conflicts = preview?.filter((occurrence) => !occurrence.wouldGenerate) ?? [];
  // Every single previewed date conflicts — this rule would generate
  // literally nothing, so there's nothing to confirm creating.
  const allConflict = !!preview && preview.length > 0 && conflicts.length === preview.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("newRule")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t("customer")}</label>
            {customerId && customerName ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm">{customerName}</p>
                {!presetCustomerId && canSearchCustomers && (
                  <button
                    type="button"
                    className="text-muted-foreground text-xs underline"
                    onClick={() => {
                      setCustomerId("");
                      setCustomerName("");
                    }}
                  >
                    {t("changeCustomer")}
                  </button>
                )}
              </div>
            ) : canSearchCustomers ? (
              <div className="flex flex-col gap-1">
                <Input
                  placeholder={t("customerSearchPlaceholder")}
                  value={customerQuery}
                  onChange={(event) => setCustomerQuery(event.target.value)}
                />
                {showCustomerResults && showCustomerResults.length > 0 && (
                  <div className="flex flex-col gap-1 rounded-lg border p-1">
                    {showCustomerResults.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        className="hover:bg-muted rounded-md px-2 py-1 text-left text-sm"
                        onClick={() => {
                          setCustomerId(customer.id);
                          setCustomerName(customer.name);
                        }}
                      >
                        {customer.name}
                        {customer.phone && (
                          <span className="text-muted-foreground">
                            {" "}
                            · {customer.phone}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {showCustomerResults && showCustomerResults.length === 0 && (
                  <p className="text-muted-foreground text-xs">
                    {t("noCustomersFound")}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                {t("noCustomerSearchPermission")}
              </p>
            )}
          </div>

          {isAdmin && (
            <div className="flex flex-col gap-1">
              <label htmlFor="recurring-employee" className="text-sm font-medium">
                {t("employee")}
              </label>
              <Select
                id="recurring-employee"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
              >
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {employeeHasNoSchedule ? (
            <p className="text-amber-700 dark:text-amber-400 text-sm">
              {t("noScheduleBody")}
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label htmlFor="recurring-service" className="text-sm font-medium">
                  {t("service")}
                </label>
                <Select
                  id="recurring-service"
                  value={serviceId}
                  onChange={(event) => setServiceId(event.target.value)}
                >
                  <option value="">{t("selectService")}</option>
                  {availableServices.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="recurring-day" className="text-sm font-medium">
                  {t("dayOfWeek")}
                </label>
                <Select
                  id="recurring-day"
                  value={dayOfWeek}
                  onChange={(event) => setDayOfWeek(event.target.value)}
                >
                  {days.map((name, index) => (
                    <option key={name} value={index}>
                      {name}
                    </option>
                  ))}
                </Select>
              </div>

              <FormField
                id="recurring-start-time"
                label={t("startTime")}
                type="time"
                value={startTime}
                onChange={setStartTime}
              />

              <FormField
                id="recurring-interval"
                label={t("intervalWeeks")}
                type="number"
                value={intervalWeeks}
                onChange={setIntervalWeeks}
                hint={t("intervalWeeksHint")}
              />

              <FormField
                id="recurring-start-date"
                label={t("startDate")}
                type="date"
                value={startDate}
                onChange={setStartDate}
              />

              <div className="flex flex-col gap-1">
                <label htmlFor="recurring-end-date" className="text-sm font-medium">
                  {t("endDate")}
                </label>
                <Input
                  id="recurring-end-date"
                  type="date"
                  min={startDate}
                  max={addOneYear(startDate)}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
                <p className="text-muted-foreground text-xs">{t("endDateHint")}</p>
              </div>
            </>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={previewing || employeeHasNoSchedule}>
              {previewing && <Spinner />}
              {previewing ? tc("saving") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!submitting) setConfirmOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("confirmCreateTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 text-sm">
            {allConflict ? (
              <p className="text-destructive">{t("confirmCreateAllConflictWarning")}</p>
            ) : conflicts.length > 0 ? (
              <p className="text-amber-600 dark:text-amber-500">
                {t("confirmCreateConflictsWarning", { count: conflicts.length })}
              </p>
            ) : (
              <p className="text-muted-foreground">
                {t("confirmCreateNoConflictsNote", {
                  count: preview?.length ?? 0,
                  startDate: formatDate(startDate, locale),
                  endDate: formatDate(endDate, locale),
                })}
              </p>
            )}
            {conflicts.length > 0 && (
              <ul className="text-muted-foreground max-h-48 list-disc overflow-y-auto pl-5">
                {conflicts.map((occurrence) => (
                  <li key={occurrence.date}>
                    {t("confirmCreateConflictItem", {
                      date: formatDate(occurrence.date, locale),
                      reason: occurrence.reason
                        ? t(`conflictReason_${occurrence.reason}`)
                        : "",
                    })}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
            >
              {tc("cancel")}
            </Button>
            {!allConflict && (
              <Button type="button" size="sm" onClick={performCreate} disabled={submitting}>
                {submitting && <Spinner />}
                {submitting ? tc("saving") : t("create")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

// EditRecurringAppointmentDialog changes an existing rule's service,
// weekday, time, interval, or end_date — never its customer or employee,
// which the backend never allows changing (deactivate and create a new
// rule instead). Editing day_of_week/start_time/interval_weeks/service_id
// only affects occurrences not yet generated; already-created appointments
// are untouched. This is also how an expired rule is reactivated — there's
// no separate action for that on the backend, just moving end_date to a
// date on or after today — so an expired rule's note and date bounds
// (never before the rule's own immutable start_date, never more than a
// year past it) show here too.
function EditRecurringAppointmentDialog({
  rule,
  services,
  onOpenChange,
  onSaved,
}: {
  rule: RecurringAppointment | null;
  services: Service[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("RecurringAppointments");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const days = dayNames(locale);

  const [serviceId, setServiceId] = useState(rule?.service_id ?? "");
  const [dayOfWeek, setDayOfWeek] = useState(String(rule?.day_of_week ?? 1));
  const [startTime, setStartTime] = useState(rule?.start_time ?? "");
  const [intervalWeeks, setIntervalWeeks] = useState(
    String(rule?.interval_weeks ?? 1),
  );
  const [endDate, setEndDate] = useState(
    rule && rule.expired ? addOneYear(rule.start_date) : (rule?.end_date ?? ""),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const availableServices = services.filter(
    (service) => !rule || service.employee_ids.includes(rule.employee_id),
  );

  // Both compared against the rule's own original values, so the
  // confirmation dialog only warns about what this particular save would
  // actually do — endDateShortened drives the cancellation warning (see
  // updateRecurringAppointment's own doc comment: only shortening end_date
  // ever cancels an existing appointment, never extending it or changing
  // anything else), scheduleFieldsChanged drives the "future occurrences
  // only" note.
  const endDateShortened = !!rule && !rule.expired && endDate < rule.end_date;
  const scheduleFieldsChanged =
    !!rule &&
    (serviceId !== rule.service_id ||
      dayOfWeek !== String(rule.day_of_week) ||
      startTime !== rule.start_time ||
      intervalWeeks !== String(rule.interval_weeks));

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!rule || !serviceId || !startTime || !endDate) return;
    setConfirmOpen(true);
  }

  async function performSave() {
    if (!rule) return;

    setSubmitting(true);
    setError(null);
    try {
      await updateRecurringAppointment(rule.id, {
        serviceId,
        dayOfWeek: Number(dayOfWeek),
        startTime,
        intervalWeeks: Number(intervalWeeks) || 1,
        endDate,
      });
      onSaved();
      setConfirmOpen(false);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("editError"));
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!rule} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("editRule")}</DialogTitle>
        </DialogHeader>
        {rule && (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              {rule.customer_name} · {rule.employee_name}
            </p>

            {rule.expired && (
              <p className="text-amber-600 dark:text-amber-500 text-sm">
                {t("expiredNote", { date: formatDate(rule.end_date, locale) })}
              </p>
            )}

            <div className="flex flex-col gap-1">
              <label htmlFor="edit-service" className="text-sm font-medium">
                {t("service")}
              </label>
              <Select
                id="edit-service"
                value={serviceId}
                onChange={(event) => setServiceId(event.target.value)}
              >
                <option value="">{t("selectService")}</option>
                {availableServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="edit-day" className="text-sm font-medium">
                {t("dayOfWeek")}
              </label>
              <Select
                id="edit-day"
                value={dayOfWeek}
                onChange={(event) => setDayOfWeek(event.target.value)}
              >
                {days.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>

            <FormField
              id="edit-start-time"
              label={t("startTime")}
              type="time"
              value={startTime}
              onChange={setStartTime}
            />

            <FormField
              id="edit-interval"
              label={t("intervalWeeks")}
              type="number"
              value={intervalWeeks}
              onChange={setIntervalWeeks}
              hint={t("intervalWeeksHint")}
            />

            <div className="flex flex-col gap-1">
              <label htmlFor="edit-end-date" className="text-sm font-medium">
                {t("endDate")}
              </label>
              <Input
                id="edit-end-date"
                type="date"
                min={rule.expired ? todayLocal() : rule.start_date}
                max={addOneYear(rule.start_date)}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
              <p className="text-muted-foreground text-xs">{t("editEndDateHint")}</p>
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                {tc("cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting && <Spinner />}
                {submitting ? tc("saving") : tc("save")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!submitting) setConfirmOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("confirmEditTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 text-sm">
            {endDateShortened && (
              <p className="text-amber-600 dark:text-amber-500">
                {t("confirmEditCancelsWarning", { date: formatDate(endDate, locale) })}
              </p>
            )}
            {scheduleFieldsChanged && (
              <p className="text-muted-foreground">{t("confirmEditFutureOnlyNote")}</p>
            )}
            {!endDateShortened && !scheduleFieldsChanged && (
              <p className="text-muted-foreground">{t("confirmEditGenericNote")}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
            >
              {tc("cancel")}
            </Button>
            <Button type="button" size="sm" onClick={performSave} disabled={submitting}>
              {submitting && <Spinner />}
              {submitting ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
