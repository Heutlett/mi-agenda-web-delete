"use client";

import {
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  CheckCheck,
  type LucideIcon,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

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
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Link, useRouter } from "@/i18n/navigation";
import {
  type AppointmentDetail,
  type AppointmentStatus,
  createWalkInAppointment,
  getAppointmentDetail,
  listAppointments,
} from "@/lib/api/appointments";
import { type AvailabilitySlot, getAvailability } from "@/lib/api/availability";
import { type Business, getMyBusiness } from "@/lib/api/business";
import { ApiError } from "@/lib/api/client";
import { lookupCustomerByPhone } from "@/lib/api/customers";
import { type Employee, getCurrentEmployee, listEmployees } from "@/lib/api/employees";
import { type Service, listServices } from "@/lib/api/services";
import {
  addDays,
  formatClockTime,
  formatDate,
  localDateKey,
  toIntlLocale,
  todayInTimezone,
} from "@/lib/date";
import { formatTime } from "@/lib/format";
import { type Session, useSession } from "../session-context";
import {
  calendarUrl,
  parseDateParam,
  parseOptionalDateParam,
  parseShowCancelledParam,
  parseStatusParam,
  parseViewParam,
  type ViewMode,
  weekDates,
} from "./calendar";

function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

const MIN_LOOKUP_PHONE_DIGITS = 8;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export const STATUS_VARIANT: Record<
  AppointmentStatus,
  "info" | "success" | "destructive" | "warning"
> = {
  CONFIRMED: "info",
  COMPLETED: "success",
  CANCELLED: "destructive",
  MISSED: "warning",
};

const STATUS_LABEL_KEY: Record<AppointmentStatus, string> = {
  CONFIRMED: "statusConfirmed",
  COMPLETED: "statusCompleted",
  CANCELLED: "statusCancelled",
  MISSED: "statusMissed",
};

// A distinct icon per status, paired with STATUS_VARIANT's color in every
// StatusBadge, so a status reads the same way — same colored pill, same
// icon — everywhere it's shown, not just inside the calendar/list cards.
export const STATUS_ICON: Record<AppointmentStatus, LucideIcon> = {
  CONFIRMED: CalendarCheck,
  COMPLETED: CheckCheck,
  CANCELLED: XCircle,
  MISSED: AlertTriangle,
};

/** Translates an appointment status for display, using the "Appointments" namespace. */
export function statusLabel(
  status: AppointmentStatus,
  t: (key: string) => string,
): string {
  return t(STATUS_LABEL_KEY[status]);
}

/**
 * The one place a status is rendered — a colored pill with a matching
 * icon (see STATUS_VARIANT/STATUS_ICON) — so every appointment card, the
 * detail page, and the status-change dialog all show the exact same
 * shape for "this appointment is Confirmed/Completed/Cancelled/Missed."
 */
export function StatusBadge({
  status,
  t,
  className,
}: {
  status: AppointmentStatus;
  t: (key: string) => string;
  className?: string;
}) {
  const Icon = STATUS_ICON[status];
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      <Icon />
      {statusLabel(status, t)}
    </Badge>
  );
}

export function AppointmentsView() {
  const t = useTranslations("Appointments");
  const session = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const view = parseViewParam(searchParams.get("view"));
  const selectedDate = parseDateParam(searchParams.get("date"), todayLocal());
  const employeeFilter = searchParams.get("employee") ?? undefined;
  const listStart = parseOptionalDateParam(searchParams.get("start"));
  const listEnd = parseOptionalDateParam(searchParams.get("end"));
  const listStatus = parseStatusParam(searchParams.get("status"));
  const showCancelled = parseShowCancelledParam(searchParams.get("cancelled"));

  const dates = view === "week" ? weekDates(selectedDate) : [selectedDate];

  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [services, setServices] = useState<Service[] | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  // Bumped every time the dialog is opened, and used as WalkInDialog's key,
  // so each opening remounts it with fresh, blank form state rather than
  // carrying over whatever was left from the previous booking.
  const [walkInInstance, setWalkInInstance] = useState(0);
  // Bumped after a successful walk-in booking to force the active view
  // (calendar or list, whichever is showing) to refetch — both already key
  // themselves off a string that includes this, the same trick their own
  // filter changes already use to force a remount.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (session.role !== "admin") return;
    listEmployees()
      .then(setEmployees)
      .catch(() => {
        // The employee filter is a convenience; if it fails to load, the
        // calendar still works unfiltered.
      });
  }, [session.role]);

  useEffect(() => {
    listServices()
      .then(setServices)
      .catch(() => {
        // The walk-in dialog just won't have a service to pick if this
        // fails; the rest of the page still works.
      });
  }, []);

  useEffect(() => {
    getMyBusiness()
      .then(setBusiness)
      .catch(() => {
        // The walk-in dialog just won't be able to load available time
        // slots if this fails; the rest of the page still works.
      });
  }, []);

  function navigate(overrides: {
    view?: ViewMode;
    date?: string;
    employee?: string;
    start?: string;
    end?: string;
    status?: AppointmentStatus;
    showCancelled?: boolean;
  }) {
    router.push(
      calendarUrl({
        view,
        date: selectedDate,
        employee: employeeFilter,
        start: listStart,
        end: listEnd,
        status: listStatus,
        showCancelled,
        ...overrides,
      }),
    );
  }

  function shift(direction: 1 | -1) {
    const step = view === "week" ? 7 : 1;
    navigate({ date: addDays(selectedDate, step * direction) });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 text-lg font-semibold">
        <CalendarDays className="text-primary size-5" />
        {t("title")}
      </h1>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setWalkInInstance((instance) => instance + 1);
            setWalkInOpen(true);
          }}
        >
          <UserPlus />
          {t("addWalkIn")}
        </Button>
        {view !== "list" && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => shift(-1)}
            >
              {t("previous")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate({ date: todayLocal() })}
            >
              {t("today")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => shift(1)}
            >
              {t("next")}
            </Button>
          </>
        )}
        <Select
          className="w-auto"
          value={view}
          onChange={(event) =>
            navigate({ view: event.target.value as ViewMode })
          }
        >
          <option value="week">{t("viewWeek")}</option>
          <option value="day">{t("viewDay")}</option>
          <option value="list">{t("viewList")}</option>
        </Select>
        {session.role === "admin" && employees && (
          <Select
            className="w-auto"
            value={employeeFilter ?? ""}
            onChange={(event) =>
              navigate({ employee: event.target.value || undefined })
            }
          >
            <option value="">{t("allEmployees")}</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </Select>
        )}
        {view !== "list" && (
          <label className="flex items-center gap-1.5 text-sm select-none">
            <input
              type="checkbox"
              checked={!showCancelled}
              onChange={(event) =>
                navigate({ showCancelled: !event.target.checked })
              }
              className="accent-primary size-3.5"
            />
            {t("hideCancelled")}
          </label>
        )}
        {view === "list" && (
          <>
            <Input
              type="date"
              className="w-auto"
              value={listStart ?? ""}
              onChange={(event) =>
                navigate({ start: event.target.value || undefined })
              }
            />
            <Input
              type="date"
              className="w-auto"
              value={listEnd ?? ""}
              onChange={(event) =>
                navigate({ end: event.target.value || undefined })
              }
            />
            <Select
              className="w-auto"
              value={listStatus ?? ""}
              onChange={(event) =>
                navigate({
                  status: (event.target.value || undefined) as
                    AppointmentStatus | undefined,
                })
              }
            >
              <option value="">{t("anyStatus")}</option>
              <option value="CONFIRMED">{t("statusConfirmed")}</option>
              <option value="CANCELLED">{t("statusCancelled")}</option>
              <option value="COMPLETED">{t("statusCompleted")}</option>
              <option value="MISSED">{t("statusMissed")}</option>
            </Select>
          </>
        )}
      </div>

      {view === "list" ? (
        <AppointmentsList
          key={`${listStart ?? ""}-${listEnd ?? ""}-${listStatus ?? ""}-${employeeFilter ?? "all"}-${refreshKey}`}
          session={session}
          employeeFilter={employeeFilter}
          startDate={listStart}
          endDate={listEnd}
          status={listStatus}
        />
      ) : (
        <AppointmentsCalendar
          key={`${dates[0]}-${dates[dates.length - 1]}-${employeeFilter ?? "all"}-${refreshKey}`}
          session={session}
          view={view}
          dates={dates}
          employeeFilter={employeeFilter}
          startDate={dates[0]}
          endDate={dates[dates.length - 1]}
          showCancelled={showCancelled}
        />
      )}

      <WalkInDialog
        key={walkInInstance}
        open={walkInOpen}
        onOpenChange={setWalkInOpen}
        session={session}
        employees={employees}
        services={services}
        business={business}
        onCreated={() => {
          setWalkInOpen(false);
          setRefreshKey((key) => key + 1);
        }}
      />
    </div>
  );
}

function WalkInDialog({
  open,
  onOpenChange,
  session,
  employees,
  services,
  business,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: Session;
  employees: Employee[] | null;
  services: Service[] | null;
  business: Business | null;
  onCreated: () => void;
}) {
  const t = useTranslations("Appointments");
  const locale = toIntlLocale(useLocale());
  const [employeeId, setEmployeeId] = useState("");
  const [ownEmployeeId, setOwnEmployeeId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(
    business ? todayInTimezone(business.timezone) : todayLocal(),
  );
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(
    null,
  );
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  // Shown once the name field gets auto-filled from a matching existing
  // customer, so staff know why it's not blank and that they can still
  // change it — same convenience the public booking form gives customers.
  const [nameWasFilled, setNameWasFilled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsEmployeeChoice = session.role === "admin";
  const effectiveEmployeeId = needsEmployeeChoice ? employeeId : ownEmployeeId;

  // Looks up whether the phone being typed already belongs to a customer
  // in this business, once it looks complete enough, and fills the name
  // field in directly. Never overwrites a name staff already typed.
  useEffect(() => {
    if (digitsOnly(customerPhone).length < MIN_LOOKUP_PHONE_DIGITS) return;
    const phone = customerPhone;

    const timeout = setTimeout(() => {
      lookupCustomerByPhone(phone)
        .then((result) => {
          if (!result.found || !result.name) return;
          // Best-effort convenience: never overwrite a name staff have
          // already typed by the time this resolves.
          if (customerName.trim()) return;
          setCustomerName(result.name);
          setNameWasFilled(true);
        })
        .catch(() => {
          // Best-effort convenience only; a failed lookup just means no
          // pre-fill, never an error staff need to see.
        });
    }, 500);

    return () => clearTimeout(timeout);
    // Deliberately excludes customerName: this should only re-run when the
    // phone changes, not on every keystroke in the name field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerPhone]);

  useEffect(() => {
    if (needsEmployeeChoice) return;
    getCurrentEmployee()
      .then((employee) => setOwnEmployeeId(employee.id))
      .catch(() => {
        // Slots just won't load below; the dialog still shows a clear error.
      });
  }, [needsEmployeeChoice]);

  // Whenever the employee, service, or date changes, any previously
  // fetched slots (and whatever was selected from them) belong to a
  // combination the form no longer reflects, so they're cleared in the
  // same render that notices the change — before the browser paints,
  // rather than via an effect one tick later — so a stale slot picked for
  // a different date can never be the one a fast double-click submits.
  const slotsRequestKey = `${effectiveEmployeeId ?? ""}|${serviceId}|${date}`;
  const [loadedSlotsKey, setLoadedSlotsKey] = useState(slotsRequestKey);
  if (loadedSlotsKey !== slotsRequestKey) {
    setLoadedSlotsKey(slotsRequestKey);
    setSlots(null);
    setSlotsError(null);
    setSelectedSlot(null);
  }

  useEffect(() => {
    if (!business || !effectiveEmployeeId || !serviceId || !date) return;
    let cancelled = false;

    getAvailability({
      businessSlug: business.slug,
      employeeId: effectiveEmployeeId,
      serviceId,
      date,
    })
      .then((result) => {
        if (!cancelled) setSlots(result.slots);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSlotsError(err instanceof ApiError ? err.message : t("walkInError"));
      });

    return () => {
      cancelled = true;
    };
  }, [business, effectiveEmployeeId, serviceId, date, t]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (
      (needsEmployeeChoice && !employeeId) ||
      !serviceId ||
      !selectedSlot ||
      !customerName
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await createWalkInAppointment({
        employeeId: needsEmployeeChoice ? employeeId : undefined,
        serviceId,
        startTime: selectedSlot.start_time,
        customer: {
          name: customerName,
          ...(customerPhone ? { phone: customerPhone } : {}),
        },
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("walkInError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("walkInTitle")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          {needsEmployeeChoice && (
            <div className="flex flex-col gap-1">
              <label htmlFor="walk-in-employee" className="text-sm font-medium">
                {t("walkInEmployee")}
              </label>
              <Select
                id="walk-in-employee"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                required
              >
                <option value="" disabled>
                  {t("walkInSelectEmployee")}
                </option>
                {employees?.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor="walk-in-service" className="text-sm font-medium">
              {t("walkInService")}
            </label>
            <Select
              id="walk-in-service"
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
              required
            >
              <option value="" disabled>
                {t("walkInSelectService")}
              </option>
              {services
                ?.filter((service) => service.status === "active")
                .map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="walk-in-date" className="text-sm font-medium">
              {t("walkInDate")}
            </label>
            <Input
              id="walk-in-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("walkInTime")}</span>
            {!effectiveEmployeeId || !serviceId ? (
              <p className="text-muted-foreground text-sm">
                {needsEmployeeChoice && !effectiveEmployeeId
                  ? t("walkInPickEmployeeAndService")
                  : t("walkInPickService")}
              </p>
            ) : slotsError ? (
              <p className="text-destructive text-sm">{slotsError}</p>
            ) : slots === null ? (
              <div className="flex justify-center p-3">
                <Spinner className="size-5" />
              </div>
            ) : slots.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t("walkInNoSlots")}
              </p>
            ) : (
              <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                {slots.map((slot) => (
                  <Button
                    key={slot.start_time}
                    type="button"
                    size="sm"
                    variant={
                      selectedSlot?.start_time === slot.start_time
                        ? "default"
                        : "outline"
                    }
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {formatTime(slot.start_time, business!.timezone, locale)}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="walk-in-phone" className="text-sm font-medium">
              {t("walkInCustomerPhone")}{" "}
              <span className="text-muted-foreground font-normal">
                {t("walkInOptional")}
              </span>
            </label>
            <Input
              id="walk-in-phone"
              type="tel"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="walk-in-name" className="text-sm font-medium">
              {t("walkInCustomerName")}
            </label>
            <Input
              id="walk-in-name"
              value={customerName}
              onChange={(event) => {
                setCustomerName(event.target.value);
                setNameWasFilled(false);
              }}
              required
            />
            {nameWasFilled && (
              <p className="text-muted-foreground text-xs">
                {t("walkInNameFilled")}
              </p>
            )}
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={busy || !selectedSlot}>
              {busy ? <Spinner className="size-4" /> : t("walkInSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AppointmentsCalendar({
  session,
  view,
  dates,
  employeeFilter,
  startDate,
  endDate,
  showCancelled,
}: {
  session: Session;
  view: ViewMode;
  dates: string[];
  employeeFilter: string | undefined;
  startDate: string;
  endDate: string;
  showCancelled: boolean;
}) {
  const t = useTranslations("Appointments");
  const [appointments, setAppointments] = useState<AppointmentDetail[] | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listAppointments({
      employeeId: session.role === "admin" ? employeeFilter : undefined,
      startDate,
      endDate,
    })
      .then((bare) => Promise.all(bare.map((a) => getAppointmentDetail(a.id))))
      .then((details) => {
        if (!cancelled) setAppointments(details);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : t("loadError"));
      });

    return () => {
      cancelled = true;
    };
  }, [session.role, employeeFilter, startDate, endDate, t]);

  if (loadError) {
    return <p className="text-destructive text-sm">{loadError}</p>;
  }

  if (!appointments) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  const visibleAppointments = showCancelled
    ? appointments
    : appointments.filter((a) => a.status !== "CANCELLED");

  return (
    <div
      className={
        view === "week"
          ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7"
          : "flex flex-col gap-4"
      }
    >
      {dates.map((date) => (
        <DayColumn
          key={date}
          date={date}
          showEmployee={session.role === "admin"}
          appointments={visibleAppointments.filter(
            (a) => localDateKey(a.start_time) === date,
          )}
        />
      ))}
    </div>
  );
}

function DayColumn({
  date,
  appointments,
  showEmployee,
}: {
  date: string;
  appointments: AppointmentDetail[];
  showEmployee: boolean;
}) {
  const t = useTranslations("Appointments");
  const locale = toIntlLocale(useLocale());
  const sorted = [...appointments].sort((a, b) =>
    a.start_time.localeCompare(b.start_time),
  );

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">{formatDate(date, locale)}</h2>
      {sorted.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          {t("noAppointments")}
        </p>
      ) : (
        sorted.map((appointment) => (
          <Link
            key={appointment.id}
            href={`/admin/appointments/${appointment.id}`}
            className="block"
          >
            <Card size="sm" className="hover:bg-muted/50 transition-colors">
              <CardContent className="flex flex-col items-start gap-1 text-sm">
                <span className="font-medium">
                  {formatClockTime(appointment.start_time, locale)}
                </span>
                <StatusBadge status={appointment.status} t={t} />
                <p className="w-full break-words">{appointment.service.name}</p>
                <p className="text-muted-foreground w-full break-words">
                  {appointment.customer.name}
                  {showEmployee && ` · ${appointment.employee.name}`}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}

function AppointmentsList({
  session,
  employeeFilter,
  startDate,
  endDate,
  status,
}: {
  session: Session;
  employeeFilter: string | undefined;
  startDate: string | undefined;
  endDate: string | undefined;
  status: AppointmentStatus | undefined;
}) {
  const t = useTranslations("Appointments");
  const locale = toIntlLocale(useLocale());
  const [appointments, setAppointments] = useState<AppointmentDetail[] | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listAppointments({
      employeeId: session.role === "admin" ? employeeFilter : undefined,
      startDate,
      endDate,
      status,
    })
      .then((bare) => Promise.all(bare.map((a) => getAppointmentDetail(a.id))))
      .then((details) => {
        if (!cancelled) {
          setAppointments(
            [...details].sort((a, b) =>
              a.start_time.localeCompare(b.start_time),
            ),
          );
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : t("loadError"));
      });

    return () => {
      cancelled = true;
    };
  }, [session.role, employeeFilter, startDate, endDate, status, t]);

  if (loadError) {
    return <p className="text-destructive text-sm">{loadError}</p>;
  }

  if (!appointments) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("noAppointmentsFiltered")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {appointments.map((appointment) => (
        <Link
          key={appointment.id}
          href={`/admin/appointments/${appointment.id}`}
          className="block"
        >
          <Card size="sm" className="hover:bg-muted/50 transition-colors">
            <CardContent className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {formatDate(localDateKey(appointment.start_time), locale)} ·{" "}
                  {formatClockTime(appointment.start_time, locale)}
                </p>
                <p className="break-words">{appointment.service.name}</p>
                <p className="text-muted-foreground break-words">
                  {appointment.customer.name}
                  {session.role === "admin" && ` · ${appointment.employee.name}`}
                </p>
              </div>
              <StatusBadge status={appointment.status} t={t} />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
