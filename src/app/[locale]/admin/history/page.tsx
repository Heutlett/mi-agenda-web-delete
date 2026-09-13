"use client";

import { Banknote, Clock, Scissors, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import {
  type AppointmentDetail,
  type AppointmentStatus,
  type PaymentStatus,
  getAppointmentDetail,
  getRevenueTotal,
  listAppointments,
} from "@/lib/api/appointments";
import { ApiError } from "@/lib/api/client";
import { onAppointmentChanged } from "@/lib/appointment-events";
import { type Employee, listEmployees } from "@/lib/api/employees";
import { type Service, listServices } from "@/lib/api/services";
import {
  formatClockTime,
  formatDate,
  localDateKey,
  toIntlLocale,
  todayInTimezone,
} from "@/lib/date";
import { DEFAULT_CURRENCY_SYMBOL, formatDuration, formatPrice } from "@/lib/format";
import { useBusinessSettings } from "../business-context";
import { useSession } from "../session-context";
import { StatusBadge } from "../appointments/appointments-view";
import { type Period, periodRange } from "./period";

const PERIODS: Period[] = ["day", "week", "month", "custom"];
const ALL_STATUSES: AppointmentStatus[] = [
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "MISSED",
];
const STATUS_LABEL_KEY: Record<AppointmentStatus, string> = {
  CONFIRMED: "statusConfirmed",
  COMPLETED: "statusCompleted",
  CANCELLED: "statusCancelled",
  MISSED: "statusMissed",
};
const ALL_PAYMENT_STATUSES: PaymentStatus[] = [
  "PAID",
  "PENDING",
  "OVERDUE",
  "NOT_APPLICABLE",
];
const PAYMENT_STATUS_LABEL_KEY: Record<PaymentStatus, string> = {
  PAID: "paymentStatusPaid",
  PENDING: "paymentStatusPending",
  OVERDUE: "paymentStatusOverdue",
  NOT_APPLICABLE: "paymentStatusNotApplicable",
};
const PAYMENT_STATUS_BADGE_VARIANT: Record<
  PaymentStatus,
  "success" | "warning" | "destructive" | "secondary"
> = {
  PAID: "success",
  PENDING: "warning",
  OVERDUE: "destructive",
  NOT_APPLICABLE: "secondary",
};

export default function HistoryPage() {
  const t = useTranslations("History");
  const ta = useTranslations("Appointments");
  const tc = useTranslations("Customers");
  const session = useSession();
  const { business } = useBusinessSettings();
  const currencySymbol = business?.currency_symbol ?? DEFAULT_CURRENCY_SYMBOL;
  const [period, setPeriod] = useState<Period>("day");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "">("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<
    PaymentStatus | ""
  >("");
  const [serviceFilter, setServiceFilter] = useState<string>("");
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [services, setServices] = useState<Service[] | null>(null);

  useEffect(() => {
    if (session.role !== "admin") return;
    listEmployees()
      .then(setEmployees)
      .catch(() => {
        // The employee filter is a convenience; if it fails to load, the
        // history still works unfiltered.
      });
  }, [session.role]);

  useEffect(() => {
    listServices()
      .then(setServices)
      .catch(() => {
        // Same as above: the service filter is a convenience.
      });
  }, []);

  const timezone = business?.timezone;
  const today = timezone ? todayInTimezone(timezone) : "";
  const { start, end } =
    period === "custom"
      ? { start: customStart, end: customEnd }
      : timezone
        ? periodRange(period, today)
        : { start: "", end: "" };
  const rangeReady = !!timezone && !!start && !!end;

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-lg font-semibold">{t("title")}</h1>

      <div className="flex flex-wrap items-center gap-2">
        <div className="border-input flex w-fit gap-1 rounded-lg border p-1">
          {PERIODS.map((p) => (
            <Button
              key={p}
              type="button"
              variant={p === period ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {t(p)}
            </Button>
          ))}
        </div>

        {period === "custom" && (
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={customStart}
              max={customEnd || undefined}
              onChange={(event) => setCustomStart(event.target.value)}
              className="w-auto"
            />
            <span className="text-muted-foreground text-sm">–</span>
            <Input
              type="date"
              value={customEnd}
              min={customStart || undefined}
              onChange={(event) => setCustomEnd(event.target.value)}
              className="w-auto"
            />
          </div>
        )}

        {session.role === "admin" && employees && employees.length > 1 && (
          <Select
            className="w-auto"
            value={employeeFilter}
            onChange={(event) => setEmployeeFilter(event.target.value)}
          >
            <option value="">{t("allEmployees")}</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </Select>
        )}

        <Select
          className="w-auto"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as AppointmentStatus | "")
          }
        >
          <option value="">{ta("anyStatus")}</option>
          {ALL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {ta(STATUS_LABEL_KEY[status])}
            </option>
          ))}
        </Select>

        <Select
          className="w-auto"
          value={paymentStatusFilter}
          onChange={(event) =>
            setPaymentStatusFilter(event.target.value as PaymentStatus | "")
          }
        >
          <option value="">{t("anyPaymentStatus")}</option>
          {ALL_PAYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(PAYMENT_STATUS_LABEL_KEY[status])}
            </option>
          ))}
        </Select>

        {services && services.length > 0 && (
          <Select
            className="w-auto"
            value={serviceFilter}
            onChange={(event) => setServiceFilter(event.target.value)}
          >
            <option value="">{tc("anyService")}</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {!rangeReady ? (
        period === "custom" ? (
          <p className="text-muted-foreground text-sm">
            {t("pickCustomRange")}
          </p>
        ) : (
          <div className="flex justify-center p-6">
            <Spinner className="size-6" />
          </div>
        )
      ) : (
        <HistoryContent
          key={`${start}:${end}:${employeeFilter}:${statusFilter}:${paymentStatusFilter}:${serviceFilter}`}
          isAdmin={session.role === "admin"}
          employeeFilter={employeeFilter}
          statusFilter={statusFilter}
          paymentStatusFilter={paymentStatusFilter}
          serviceFilter={serviceFilter}
          employees={employees}
          start={start}
          end={end}
          currencySymbol={currencySymbol}
        />
      )}
    </div>
  );
}

function HistoryContent({
  isAdmin,
  employeeFilter,
  statusFilter,
  paymentStatusFilter,
  serviceFilter,
  employees,
  start,
  end,
  currencySymbol,
}: {
  isAdmin: boolean;
  employeeFilter: string;
  statusFilter: AppointmentStatus | "";
  paymentStatusFilter: PaymentStatus | "";
  serviceFilter: string;
  employees: Employee[] | null;
  start: string;
  end: string;
  currencySymbol: string;
}) {
  const t = useTranslations("History");
  const ta = useTranslations("Appointments");
  const locale = toIntlLocale(useLocale());
  const [total, setTotal] = useState<number | null>(null);
  const [employeeTotals, setEmployeeTotals] = useState<Record<string, number>>(
    {},
  );
  const [appointments, setAppointments] = useState<AppointmentDetail[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
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

    async function load() {
      try {
        const bare = await listAppointments({
          employeeId: employeeFilter || undefined,
          status: statusFilter || undefined,
          paymentStatus: paymentStatusFilter || undefined,
          serviceId: serviceFilter || undefined,
          startDate: start,
          endDate: end,
        });
        if (cancelled) return;
        const detailed = await Promise.all(
          bare.map((a) => getAppointmentDetail(a.id)),
        );
        if (cancelled) return;
        // Most recent first: the point of a history view is to scan
        // backward from "just happened."
        detailed.sort((a, b) => b.start_time.localeCompare(a.start_time));
        setAppointments(detailed);

        if (!isAdmin || employeeFilter) {
          const result = await getRevenueTotal({
            startDate: start,
            endDate: end,
            employeeId: employeeFilter || undefined,
          });
          if (cancelled) return;
          setTotal(result.total ?? 0);
          return;
        }

        const loadedEmployees = employees ?? (await listEmployees());
        if (cancelled) return;
        const [businessTotal, ...perEmployee] = await Promise.all([
          getRevenueTotal({ startDate: start, endDate: end }),
          ...loadedEmployees.map((employee) =>
            getRevenueTotal({
              startDate: start,
              endDate: end,
              employeeId: employee.id,
            }),
          ),
        ]);
        if (cancelled) return;
        setTotal(businessTotal.total ?? 0);
        const totals: Record<string, number> = {};
        loadedEmployees.forEach((employee, i) => {
          totals[employee.id] = perEmployee[i].total ?? 0;
        });
        setEmployeeTotals(totals);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : t("loadError"));
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [
    isAdmin,
    employeeFilter,
    statusFilter,
    paymentStatusFilter,
    serviceFilter,
    employees,
    start,
    end,
    refreshKey,
    t,
  ]);

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  if (total === null || appointments === null) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  const filteredEmployeeName =
    employeeFilter && employees?.find((e) => e.id === employeeFilter)?.name;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {isAdmin
                ? filteredEmployeeName
                  ? t("employeeTotal", { name: filteredEmployeeName })
                  : t("businessTotal")
                : t("yourTotal")}
            </p>
            <p className="text-2xl font-semibold">
              {formatPrice(total, currencySymbol)}
            </p>
            <p className="text-muted-foreground text-xs">{t("totalOnlyPaidNote")}</p>
          </div>

          {isAdmin && !employeeFilter && employees && employees.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {t("byEmployee")}
              </p>
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className="flex items-center justify-between"
                >
                  <span>{employee.name}</span>
                  <span className="text-muted-foreground">
                    {formatPrice(
                      employeeTotals[employee.id] ?? 0,
                      currencySymbol,
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        {appointments.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noAppointments")}</p>
        ) : (
          appointments.map((appointment) => (
            <Link
              key={appointment.id}
              href={`/admin/appointments/${appointment.id}`}
            >
              <Card className="hover:bg-muted/50 transition-colors">
                <CardContent className="flex flex-col gap-2 text-sm">
                  <p className="font-medium">
                    {formatDate(localDateKey(appointment.start_time), locale)}{" "}
                    · {formatClockTime(appointment.start_time, locale)}
                  </p>
                  <p className="text-muted-foreground">
                    {appointment.customer.name}
                    {isAdmin && ` · ${appointment.employee.name}`}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={appointment.status} t={ta} />
                    <Badge variant="secondary">
                      <Scissors />
                      {appointment.service.name}
                    </Badge>
                    <Badge variant="secondary">
                      <Clock />
                      {formatDuration(appointment.service.duration_minutes)}
                    </Badge>
                    {formatPrice(appointment.price, currencySymbol) && (
                      <Badge variant="secondary">
                        <Banknote />
                        {formatPrice(appointment.price, currencySymbol)}
                      </Badge>
                    )}
                    <Badge variant={PAYMENT_STATUS_BADGE_VARIANT[appointment.payment_status]}>
                      <Wallet />
                      {t(PAYMENT_STATUS_LABEL_KEY[appointment.payment_status])}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
