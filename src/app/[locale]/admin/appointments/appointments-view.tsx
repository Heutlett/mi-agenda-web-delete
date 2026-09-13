"use client";

import {
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useRouter } from "@/i18n/navigation";
import {
  type AppointmentListItem,
  type AppointmentStatus,
  createWalkInAppointment,
  listAppointments,
} from "@/lib/api/appointments";
import { type AvailabilitySlot, getAvailability } from "@/lib/api/availability";
import {
  type AvailabilityBlock,
  createAvailabilityBlock,
  deleteAvailabilityBlock,
  listAvailabilityBlocks,
  updateAvailabilityBlock,
} from "@/lib/api/availability-blocks";
import { type Business, getMyBusiness } from "@/lib/api/business";
import { ApiError } from "@/lib/api/client";
import { onAppointmentChanged } from "@/lib/appointment-events";
import { lookupCustomerByPhone } from "@/lib/api/customers";
import { type Employee, getCurrentEmployee, listEmployees } from "@/lib/api/employees";
import {
  createLunchSkip,
  listLunchSkips,
  listSchedules,
  type LunchSkip,
  type Schedule,
} from "@/lib/api/schedules";
import { type Service, listServices } from "@/lib/api/services";
import { addDays, toIntlLocale, todayInTimezone } from "@/lib/date";
import { formatDuration, formatTime } from "@/lib/format";
import { employeeIdsWithActiveSchedule, employeeHasActiveSchedule } from "@/lib/schedule-check";
import { cn } from "@/lib/utils";
import { type Session, useSession } from "../session-context";
import {
  businessHoursForDate,
  dateKeyInZone,
  isWithinWorkingHours,
  lunchWindowsForDate,
  minutesSinceMidnightInZone,
  minutesToTime,
  timeToMinutes,
  zonedTimeToISOString,
} from "./calendar-grid";
import {
  calendarRangeLabel,
  calendarUrl,
  parseDateParam,
  parseShowCancelledParam,
  parseViewParam,
  type ViewMode,
  weekDates,
} from "./calendar";
import { TimeGrid, type TimeGridDay } from "./time-grid";

function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

const MIN_LOOKUP_PHONE_DIGITS = 8;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * A customer-name field that auto-fills itself from a matching existing
 * customer once phone looks complete enough — the same convenience the
 * public booking form gives customers. Never overwrites a name staff have
 * already typed; shared by both appointment-creation dialogs below so the
 * lookup/debounce logic exists in exactly one place.
 */
function useCustomerNameLookup(phone: string) {
  const [name, setNameRaw] = useState("");
  const [nameWasFilled, setNameWasFilled] = useState(false);

  function setName(value: string) {
    setNameRaw(value);
    setNameWasFilled(false);
  }

  useEffect(() => {
    if (digitsOnly(phone).length < MIN_LOOKUP_PHONE_DIGITS) return;

    const timeout = setTimeout(() => {
      lookupCustomerByPhone(phone)
        .then((result) => {
          if (!result.found || !result.name) return;
          // Checked via the functional updater, not a `name` dependency, so
          // this only ever re-runs when the phone itself changes, not on
          // every keystroke in the name field.
          setNameRaw((current) => {
            if (current.trim()) return current;
            setNameWasFilled(true);
            return result.name!;
          });
        })
        .catch(() => {
          // Best-effort convenience only; a failed lookup just means no
          // pre-fill, never an error staff need to see.
        });
    }, 500);

    return () => clearTimeout(timeout);
  }, [phone]);

  return { name, setName, nameWasFilled };
}

/**
 * A booking-creation failure's message, shown inline by both WalkInDialog
 * and SlotAppointmentDialog. A 409 (the requested time was just taken, or
 * always was) gets a specific, actionable, translated message rather than
 * the backend's own plain-English "the selected time is not available" —
 * this app has no per-error-code i18n, so every other ApiError still shows
 * its raw backend text as before; 409 is singled out because it's by far
 * the most common failure here and the one worth explaining rather than
 * just reporting.
 */
function walkInErrorMessage(err: unknown, t: (key: string) => string): string {
  if (err instanceof ApiError) {
    return err.status === 409 ? t("walkInConflictError") : err.message;
  }
  return t("walkInError");
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
  const locale = toIntlLocale(useLocale());
  const session = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const view = parseViewParam(searchParams.get("view"));
  const selectedDate = parseDateParam(searchParams.get("date"), todayLocal());
  const employeeFilter = searchParams.get("employee") ?? undefined;
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
  // The other appointment-creation dialog, opened from a grid slot's own
  // "Agregar cita" instead of the toolbar's — see SlotAppointmentDialog for
  // why it's a separate component rather than WalkInDialog reused with
  // prefilled values.
  const [slotApptOpen, setSlotApptOpen] = useState(false);
  const [slotApptInstance, setSlotApptInstance] = useState(0);
  const [slotApptDefaults, setSlotApptDefaults] = useState<{
    date: string;
    startTime: string;
    employeeId: string;
  } | null>(null);
  // Bumped after a successful walk-in booking to force the calendar to
  // refetch — it already keys itself off a string that includes this, the
  // same trick its own filter changes already use to force a remount.
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
    showCancelled?: boolean;
  }) {
    router.push(
      calendarUrl({
        view,
        date: selectedDate,
        employee: employeeFilter,
        showCancelled,
        ...overrides,
      }),
    );
  }

  function shift(direction: 1 | -1) {
    const step = view === "week" ? 7 : 1;
    navigate({ date: addDays(selectedDate, step * direction) });
  }

  function openWalkInDialog() {
    setWalkInInstance((instance) => instance + 1);
    setWalkInOpen(true);
  }

  // The slot itself is already known-free (it's what made it clickable), so
  // this skips WalkInDialog's "browse available slots" step entirely and
  // prefills the exact date/time clicked, in the business's own timezone —
  // still freely editable, and still re-validated at submit like any other
  // booking.
  function openSlotAppointmentDialog(params: {
    date: string;
    startISO: string;
    employeeId: string;
  }) {
    if (!business) return;
    setSlotApptDefaults({
      date: params.date,
      startTime: minutesToTime(
        minutesSinceMidnightInZone(params.startISO, business.timezone),
      ),
      employeeId: params.employeeId,
    });
    setSlotApptInstance((instance) => instance + 1);
    setSlotApptOpen(true);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-3 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarDays className="text-primary size-5" />
            {t("title")}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {LEGEND_STATUSES.map((status) => (
              <span key={status} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-2.5 rounded-sm",
                    status === "CONFIRMED" && "bg-blue-500",
                    status === "COMPLETED" && "bg-green-600",
                    status === "MISSED" && "bg-amber-500",
                    status === "CANCELLED" && "bg-red-500",
                  )}
                />
                <span className="text-muted-foreground">
                  {statusLabel(status, t)}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
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
              size="icon-sm"
              aria-label={t("previous")}
              onClick={() => shift(-1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={t("next")}
              onClick={() => shift(1)}
            >
              <ChevronRight />
            </Button>
            <span className="text-xl font-semibold tracking-tight">
              {calendarRangeLabel(dates, locale)}
            </span>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="bg-muted inline-flex items-center gap-0.5 rounded-lg p-0.5">
              <Button
                type="button"
                variant={view === "week" ? "default" : "ghost"}
                size="sm"
                onClick={() => navigate({ view: "week" })}
              >
                {t("viewWeek")}
              </Button>
              <Button
                type="button"
                variant={view === "day" ? "default" : "ghost"}
                size="sm"
                onClick={() => navigate({ view: "day" })}
              >
                {t("viewDay")}
              </Button>
            </div>
            <Button type="button" size="sm" onClick={() => openWalkInDialog()}>
              <UserPlus />
              {t("addWalkIn")}
            </Button>
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
          </div>
        </div>
      </div>

      <AppointmentsCalendar
        key={`${dates[0]}-${dates[dates.length - 1]}-${employeeFilter ?? "all"}-${refreshKey}`}
        session={session}
        dates={dates}
        employeeFilter={employeeFilter}
        startDate={dates[0]}
        endDate={dates[dates.length - 1]}
        showCancelled={showCancelled}
        business={business}
        employees={employees}
        onAddAppointment={openSlotAppointmentDialog}
      />

      <WalkInDialog
        key={`walk-in-${walkInInstance}`}
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

      {slotApptDefaults && (
        <SlotAppointmentDialog
          key={`slot-appt-${slotApptInstance}`}
          open={slotApptOpen}
          onOpenChange={setSlotApptOpen}
          services={services}
          business={business}
          employeeId={slotApptDefaults.employeeId}
          initialDate={slotApptDefaults.date}
          initialStartTime={slotApptDefaults.startTime}
          onCreated={() => {
            setSlotApptOpen(false);
            setRefreshKey((key) => key + 1);
          }}
        />
      )}
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
  const [customerPhone, setCustomerPhone] = useState("");
  // nameWasFilled is shown once the name field gets auto-filled from a
  // matching existing customer, so staff know why it's not blank and that
  // they can still change it — same convenience the public booking form
  // gives customers.
  const { name: customerName, setName: setCustomerName, nameWasFilled } =
    useCustomerNameLookup(customerPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Fetched once the target employee resolves, purely to fail fast if
  // they have no working hours at all — null while loading (or before an
  // employee is picked), during which nothing is warned about yet, the
  // same "don't warn on incomplete data" convention SlotAppointmentDialog
  // already uses for its own schedule fetch.
  const [employeeSchedules, setEmployeeSchedules] = useState<Schedule[] | null>(
    null,
  );

  const needsEmployeeChoice = session.role === "admin";
  const effectiveEmployeeId = needsEmployeeChoice ? employeeId : ownEmployeeId;
  const employeeHasNoSchedule =
    employeeSchedules !== null && !employeeHasActiveSchedule(employeeSchedules);

  // Clears any previous employee's loaded schedules the moment the
  // effective employee changes, during the same render that notices the
  // change — the same derived-reset pattern slotsRequestKey/loadedSlotsKey
  // below already uses, so a change is never a beat late.
  const [loadedScheduleFor, setLoadedScheduleFor] = useState(effectiveEmployeeId);
  if (loadedScheduleFor !== effectiveEmployeeId) {
    setLoadedScheduleFor(effectiveEmployeeId);
    setEmployeeSchedules(null);
  }

  useEffect(() => {
    if (needsEmployeeChoice) return;
    getCurrentEmployee()
      .then((employee) => setOwnEmployeeId(employee.id))
      .catch(() => {
        // Slots just won't load below; the dialog still shows a clear error.
      });
  }, [needsEmployeeChoice]);

  useEffect(() => {
    if (!effectiveEmployeeId) return;
    let cancelled = false;
    listSchedules(effectiveEmployeeId)
      .then((result) => {
        if (!cancelled) setEmployeeSchedules(result);
      })
      .catch(() => {
        // No warning shown if this fails; the existing "no available
        // slots" state below still catches the practical consequence.
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveEmployeeId]);

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
      setError(walkInErrorMessage(err, t));
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
                onChange={(event) => {
                  setEmployeeId(event.target.value);
                  // The service list below is filtered by employee, so a
                  // previously selected service may no longer apply.
                  setServiceId("");
                }}
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
          {employeeHasNoSchedule ? (
            <p className="text-amber-700 dark:text-amber-400 text-sm">
              {t("noScheduleAdminBody")}
            </p>
          ) : (
            <>
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
                    ?.filter(
                      (service) =>
                        !effectiveEmployeeId ||
                        service.employee_ids.includes(effectiveEmployeeId),
                    )
                    .map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} · {formatDuration(service.duration_minutes)}
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
                  <Badge variant="destructive">{t("walkInNoSlots")}</Badge>
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
            </>
          )}
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
              onChange={(event) => setCustomerName(event.target.value)}
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

/**
 * Opened from a grid slot's own "Agregar cita," not the toolbar's — the
 * employee is already resolved by the slot menu (SlotMenuState.employeeId,
 * or its own picker) by the time this opens, and the clicked slot is
 * already known-free, so unlike WalkInDialog this skips straight past
 * "browse available slots" and prefills the exact date/time clicked
 * directly as plain, editable fields — closer to how a quick-create popover
 * works, and considerably less fiddly on a touch screen than a wrapped grid
 * of small slot buttons. The prefilled values are still just a starting
 * point: every field here can be changed before saving, and the same
 * availability check every other booking path goes through still runs at
 * submit time, so an edited-away time that's no longer actually free comes
 * back as a normal inline error rather than silently failing.
 */
function SlotAppointmentDialog({
  open,
  onOpenChange,
  services,
  business,
  employeeId,
  initialDate,
  initialStartTime,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: Service[] | null;
  business: Business | null;
  employeeId: string;
  /** "YYYY-MM-DD", the clicked slot's own date. */
  initialDate: string;
  /** "HH:MM" wall-clock time, in the business's own timezone — the clicked slot's own start. */
  initialStartTime: string;
  onCreated: () => void;
}) {
  const t = useTranslations("Appointments");
  const tc = useTranslations("Common");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  // False until the end-time field is edited directly — while false, it
  // keeps following start time + the selected service's own duration;
  // picking a different service re-trusts that service's default again,
  // discarding an earlier manual edit, the same way changing a walk-in's
  // service already resets whatever slot was selected below it.
  const [endTime, setEndTime] = useState("");
  const [endTimeTouched, setEndTimeTouched] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const { name: customerName, setName: setCustomerName, nameWasFilled } =
    useCustomerNameLookup(customerPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Fetched once, scoped to this one already-resolved employee, purely to
  // warn before overriding their configured hours (see isWithinWorkingHours)
  // — the backend still decides what's actually allowed, and a failed
  // fetch just means no warning gets shown rather than blocking the form.
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [confirmOutsideHoursOpen, setConfirmOutsideHoursOpen] = useState(false);

  useEffect(() => {
    listSchedules(employeeId)
      .then(setSchedules)
      .catch(() => {
        // No warning shown below if this fails; nothing else in the form
        // depends on it.
      });
  }, [employeeId]);

  const availableServices =
    services?.filter((service) => service.employee_ids.includes(employeeId)) ?? [];
  const selectedService = availableServices.find((s) => s.id === serviceId) ?? null;

  // Recomputes end time from start time + the selected service's own
  // duration whenever either changes, unless it's been manually edited
  // away from that default — derived during render rather than via an
  // effect, the same "notice a mismatch, adjust, re-render before paint"
  // pattern the slots list above (slotsRequestKey/loadedSlotsKey) uses.
  const defaultEndTime =
    selectedService && startTime
      ? minutesToTime(timeToMinutes(startTime) + selectedService.duration_minutes)
      : "";
  const endTimeSyncKey = `${startTime}|${serviceId}`;
  const [lastEndTimeSyncKey, setLastEndTimeSyncKey] = useState(endTimeSyncKey);
  if (lastEndTimeSyncKey !== endTimeSyncKey) {
    setLastEndTimeSyncKey(endTimeSyncKey);
    if (!endTimeTouched) setEndTime(defaultEndTime);
  }

  const endTimeValid = !!endTime && timeToMinutes(endTime) > timeToMinutes(startTime || "00:00");
  // Only meaningful once schedules has loaded and the times are valid;
  // schedules === null (still loading, or the fetch failed) never blocks
  // or warns — it just means this particular safety net isn't up yet.
  const outsideHours =
    schedules !== null &&
    endTimeValid &&
    !isWithinWorkingHours(schedules, date, timeToMinutes(startTime), timeToMinutes(endTime));

  async function performCreate() {
    setBusy(true);
    setError(null);
    try {
      await createWalkInAppointment({
        employeeId,
        serviceId,
        startTime: zonedTimeToISOString(date, timeToMinutes(startTime), business!.timezone),
        endTime: zonedTimeToISOString(date, timeToMinutes(endTime), business!.timezone),
        customer: {
          name: customerName,
          ...(customerPhone ? { phone: customerPhone } : {}),
        },
      });
      setConfirmOutsideHoursOpen(false);
      onCreated();
    } catch (err) {
      setError(walkInErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!serviceId || !date || !startTime || !endTimeValid || !customerName) return;

    if (outsideHours) {
      setConfirmOutsideHoursOpen(true);
      return;
    }
    performCreate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("slotApptTitle")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor="slot-appt-service" className="text-sm font-medium">
              {t("walkInService")}
            </label>
            <Select
              id="slot-appt-service"
              value={serviceId}
              onChange={(event) => {
                setServiceId(event.target.value);
                setEndTimeTouched(false);
              }}
              required
            >
              <option value="" disabled>
                {t("walkInSelectService")}
              </option>
              {availableServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {formatDuration(service.duration_minutes)}
                </option>
              ))}
            </Select>
          </div>
          <FormField
            id="slot-appt-date"
            label={t("walkInDate")}
            type="date"
            value={date}
            onChange={setDate}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="slot-appt-start"
              label={t("slotApptStartTime")}
              type="time"
              value={startTime}
              onChange={setStartTime}
            />
            <FormField
              id="slot-appt-end"
              label={t("slotApptEndTime")}
              type="time"
              value={endTime}
              onChange={(value) => {
                setEndTime(value);
                setEndTimeTouched(true);
              }}
              error={endTime && !endTimeValid ? t("slotApptEndBeforeStart") : undefined}
            />
          </div>
          {outsideHours && (
            <p className="text-amber-600 dark:text-amber-500 text-xs">
              {t("slotApptOutsideHoursWarning")}
            </p>
          )}
          <FormField
            id="slot-appt-phone"
            label={t("walkInCustomerPhone")}
            optional
            optionalLabel={t("walkInOptional")}
            type="tel"
            value={customerPhone}
            onChange={setCustomerPhone}
          />
          <FormField
            id="slot-appt-name"
            label={t("walkInCustomerName")}
            value={customerName}
            onChange={setCustomerName}
            hint={nameWasFilled ? t("walkInNameFilled") : undefined}
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                busy || !serviceId || !date || !startTime || !endTimeValid || !customerName
              }
            >
              {busy && <Spinner />}
              {busy ? tc("saving") : t("walkInSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <Dialog
        open={confirmOutsideHoursOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !busy) setConfirmOutsideHoursOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("slotApptOutsideHoursConfirmTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {t("slotApptOutsideHoursWarning")}
          </p>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmOutsideHoursOpen(false)}
              disabled={busy}
            >
              {tc("cancel")}
            </Button>
            <Button type="button" size="sm" onClick={performCreate} disabled={busy}>
              {busy && <Spinner />}
              {busy ? tc("saving") : t("walkInSubmit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

const LEGEND_STATUSES: AppointmentStatus[] = [
  "CONFIRMED",
  "COMPLETED",
  "MISSED",
  "CANCELLED",
];

function AppointmentsCalendar({
  session,
  dates,
  employeeFilter,
  startDate,
  endDate,
  showCancelled,
  business,
  employees,
  onAddAppointment,
}: {
  session: Session;
  dates: string[];
  employeeFilter: string | undefined;
  startDate: string;
  endDate: string;
  showCancelled: boolean;
  business: Business | null;
  /** For the empty-slot menu's employee picker, shown to an admin with no employee filter selected (there's otherwise no single unambiguous employee an empty slot belongs to). Null for an employee caller, who never needs it — they always act on their own record. */
  employees: Employee[] | null;
  onAddAppointment: (params: {
    date: string;
    startISO: string;
    employeeId: string;
  }) => void;
}) {
  const t = useTranslations("Appointments");
  const locale = toIntlLocale(useLocale());
  const [appointments, setAppointments] = useState<
    AppointmentListItem[] | null
  >(null);
  const [blocks, setBlocks] = useState<AvailabilityBlock[] | null>(null);
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [lunchSkips, setLunchSkips] = useState<LunchSkip[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blockError, setBlockError] = useState<string | null>(null);
  // Set instead of opening the empty-slot menu, when that slot's one
  // unambiguous employee has no schedule at all — see TimeGrid's
  // onNoSchedule.
  const [noScheduleEmployeeId, setNoScheduleEmployeeId] = useState<
    string | null
  >(null);
  const [ownEmployeeId, setOwnEmployeeId] = useState<string | null>(null);
  // Bumped after a slot popover's "Marcar como ocupado" succeeds, to
  // refetch blocks (and everything else) without needing the parent's own
  // refreshKey — that one's for a completed walk-in booking instead. Also
  // bumped by notifyAppointmentChanged(), fired by the appointment detail
  // modal after a save (a cancellation, most visibly) — that modal is a
  // sibling route segment layered over this page, not a child component,
  // so this is the only way it can tell this list its data is stale.
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(
    () => onAppointmentChanged(() => setLocalRefresh((key) => key + 1)),
    [],
  );

  useEffect(() => {
    if (session.role === "admin") return;
    getCurrentEmployee()
      .then((employee) => setOwnEmployeeId(employee.id))
      .catch(() => {
        // The grid's empty-slot popover just won't be interactive if this
        // fails; appointments still load and display normally.
      });
  }, [session.role]);

  // The one employee slot clicks act on: an admin's explicit filter, or
  // an employee's own record. Deliberately null for an admin with no
  // filter — several employees' appointments can share one day column,
  // so there's no single unambiguous employee an empty slot there
  // belongs to.
  const activeEmployeeId =
    session.role === "admin" ? (employeeFilter ?? null) : ownEmployeeId;

  useEffect(() => {
    if (!business) return;
    let cancelled = false;

    Promise.all([
      listAppointments({
        employeeId: session.role === "admin" ? employeeFilter : undefined,
        startDate,
        endDate,
      }),
      listAvailabilityBlocks(session.role === "admin" ? employeeFilter : undefined),
      listSchedules(session.role === "admin" ? employeeFilter : undefined),
      listLunchSkips({
        employeeId: session.role === "admin" ? employeeFilter : undefined,
        startDate,
        endDate,
      }),
    ])
      .then(([appointmentsResult, blocksResult, schedulesResult, lunchSkipsResult]) => {
        if (cancelled) return;
        setAppointments(appointmentsResult);
        setBlocks(blocksResult);
        setSchedules(schedulesResult);
        setLunchSkips(lunchSkipsResult);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : t("loadError"));
      });

    return () => {
      cancelled = true;
    };
  }, [business, session.role, employeeFilter, startDate, endDate, localRefresh, t]);

  // Unlike handleSkipLunch below, this doesn't catch its own errors: it's
  // called from BlockFormDialog (time-grid.tsx), which awaits it and shows
  // a failure inline in the dialog itself rather than in the page-level
  // banner, so the form stays open with its values intact to retry.
  async function handleMarkBusy(params: {
    employeeId: string;
    startTime: string;
    endTime: string;
    reason?: string;
  }) {
    await createAvailabilityBlock({
      employee_id: params.employeeId,
      start_time: params.startTime,
      end_time: params.endTime,
      reason: params.reason,
    });
    setLocalRefresh((key) => key + 1);
  }

  /** Also called from BlockFormDialog; see handleMarkBusy's note on error handling. */
  async function handleUpdateBlock(params: {
    id: string;
    startTime: string;
    endTime: string;
    reason?: string;
  }) {
    await updateAvailabilityBlock(params.id, {
      start_time: params.startTime,
      end_time: params.endTime,
      reason: params.reason,
    });
    setLocalRefresh((key) => key + 1);
  }

  /** Called from BlockCancelDialog, which awaits it and shows its own inline error on failure. */
  async function handleCancelBlock(id: string) {
    await deleteAvailabilityBlock(id);
    setLocalRefresh((key) => key + 1);
  }

  async function handleSkipLunch(params: { employeeId: string; date: string }) {
    setBlockError(null);
    try {
      await createLunchSkip({ employee_id: params.employeeId, date: params.date });
      setLocalRefresh((key) => key + 1);
    } catch (err) {
      setBlockError(err instanceof ApiError ? err.message : t("lunchSkipError"));
    }
  }

  if (loadError) {
    return <p className="text-destructive text-sm">{loadError}</p>;
  }

  if (!business || !appointments || !blocks || !schedules || !lunchSkips) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  const employeeIdsWithSchedule = employeeIdsWithActiveSchedule(schedules);

  const visibleAppointments = showCancelled
    ? appointments
    : appointments.filter((a) => a.status !== "CANCELLED");

  const days: TimeGridDay[] = dates.map((date) => ({
    date,
    appointments: visibleAppointments.filter(
      (a) => dateKeyInZone(a.start_time, business.timezone) === date,
    ),
    blocks: blocks.filter(
      (b) => dateKeyInZone(b.start_time, business.timezone) === date,
    ),
    businessHours: businessHoursForDate(schedules, date),
    lunchWindows: lunchWindowsForDate(
      schedules,
      date,
      new Set(
        lunchSkips.filter((skip) => skip.date === date).map((skip) => skip.employee_id),
      ),
    ),
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {blockError && (
        <p className="shrink-0 text-destructive text-xs">{blockError}</p>
      )}

      <div className="min-h-0 flex-1">
        <TimeGrid
          days={days}
          todayKey={todayInTimezone(business.timezone)}
          timeZone={business.timezone}
          showEmployee={session.role === "admin" && !employeeFilter}
          activeEmployeeId={activeEmployeeId}
          employees={activeEmployeeId ? null : employees}
          employeeIdsWithSchedule={employeeIdsWithSchedule}
          locale={locale}
          onAddAppointment={onAddAppointment}
          onMarkBusy={handleMarkBusy}
          onUpdateBlock={handleUpdateBlock}
          onCancelBlock={handleCancelBlock}
          onSkipLunch={handleSkipLunch}
          onNoSchedule={setNoScheduleEmployeeId}
        />
      </div>

      {noScheduleEmployeeId && (
        <NoScheduleDialog
          isOwnSchedule={session.role !== "admin"}
          onClose={() => setNoScheduleEmployeeId(null)}
        />
      )}
    </div>
  );
}

function NoScheduleDialog({
  isOwnSchedule,
  onClose,
}: {
  /** Whether the logged-in employee is looking at their own missing schedule, vs. an admin looking at someone else's. */
  isOwnSchedule: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Appointments");
  const tc = useTranslations("Common");
  const router = useRouter();

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("noScheduleTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          {isOwnSchedule ? t("noScheduleOwnBody") : t("noScheduleAdminBody")}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button onClick={() => router.push("/admin/schedules")}>
            {t("noScheduleGoTo")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
