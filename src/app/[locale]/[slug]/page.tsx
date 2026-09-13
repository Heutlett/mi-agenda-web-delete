import { ChevronLeft, ChevronRight, Mail, MapPin, Phone, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getAvailability, type AvailabilitySlot } from "@/lib/api/availability";
import {
  getBusinessBySlug,
  type PublicBusiness,
  type PublicEmployee,
  type PublicService,
} from "@/lib/api/business";
import { ApiError } from "@/lib/api/client";
import { formatDuration, formatPrice, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  buildMonthGrid,
  formatDate,
  formatMonthParam,
  monthLabel,
  parseMonthParam,
  shiftMonth,
  todayInTimezone,
  toIntlLocale,
  weekdayLabels,
} from "./calendar";
import { ContactForm } from "./contact-form";
import { ANY_EMPLOYEE_ID, resolveEmployee } from "./resolve-employee";
import { stepUrl } from "./step-url";
import { TimeSlotPicker } from "./time-slot-picker";

export default async function BusinessBookingPage({
  params,
  searchParams,
}: PageProps<"/[locale]/[slug]">) {
  const { slug, locale } = await params;
  const sp = await searchParams;
  const serviceId = typeof sp.service === "string" ? sp.service : undefined;
  const employeeId = typeof sp.employee === "string" ? sp.employee : undefined;
  const dateParam = typeof sp.date === "string" ? sp.date : undefined;
  const monthParam = typeof sp.month === "string" ? sp.month : undefined;
  const timeParam = typeof sp.time === "string" ? sp.time : undefined;
  const noticeParam = typeof sp.notice === "string" ? sp.notice : undefined;

  const business = await getBusinessBySlug(slug).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  });

  // The booking page's language follows the business's own `language`
  // setting, the same as the admin dashboard (AuthGuard's LocaleEnforcer):
  // only that business's admin can change it, a customer never can. This
  // redirect preserves the in-progress booking flow's own query params.
  if (
    business.language !== locale &&
    routing.locales.includes(business.language as (typeof routing.locales)[number])
  ) {
    redirect({
      href: stepUrl(slug, {
        service: serviceId,
        employee: employeeId,
        date: dateParam,
        month: monthParam,
        time: timeParam,
        notice: noticeParam,
      }),
      locale: business.language,
    });
  }

  const selectedService = serviceId
    ? business.services.find((s) => s.id === serviceId)
    : undefined;

  if (!selectedService) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <BusinessHeader business={business} />
        <ServiceList
          slug={slug}
          services={business.services}
          currencySymbol={business.currency_symbol}
        />
      </div>
    );
  }

  // Only employees actually associated with the chosen service are
  // offered here — an employee who doesn't perform this service (e.g. a
  // different specialization) should never be bookable for it, matching
  // what the backend itself now enforces at booking time. An employee
  // with no working-hours schedule at all is excluded the same way: there
  // would never be a single available date for them, so offering them
  // just leads to "try a different day" forever with no explanation.
  const bookableEmployees = business.employees.filter(
    (e) => selectedService.employee_ids.includes(e.id) && e.has_schedule,
  );
  const employee = resolveEmployee(bookableEmployees, employeeId);

  if (employee === "none") {
    return business.employees.length === 0 ? (
      <NoEmployeesStep business={business} />
    ) : (
      <NoEmployeesForServiceStep
        slug={slug}
        business={business}
        service={selectedService}
      />
    );
  }

  if (employee === "pending") {
    return (
      <EmployeeSelectionStep
        slug={slug}
        business={business}
        service={selectedService}
        employees={bookableEmployees}
      />
    );
  }

  const today = todayInTimezone(business.timezone);
  const validDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam >= today
      ? dateParam
      : undefined;

  // When there's only one employee, the picker step is skipped entirely, so
  // "back" from date selection must go all the way to the service list
  // (clearing `service` too) — otherwise it would just re-resolve straight
  // back to this same date-selection step, since a lone employee is always
  // auto-selected regardless of the `employee` param.
  const employeeBackHref =
    bookableEmployees.length > 1
      ? stepUrl(slug, { service: selectedService.id })
      : stepUrl(slug, {});

  if (!validDate) {
    return (
      <DateSelectionStep
        slug={slug}
        business={business}
        service={selectedService}
        employee={employee}
        backHref={employeeBackHref}
        monthParam={monthParam}
        today={today}
      />
    );
  }

  const employeeParam = employee === "all" ? ANY_EMPLOYEE_ID : employee.id;
  const dateBackHref = stepUrl(slug, {
    service: selectedService.id,
    employee: employeeParam,
    month: monthParam,
  });

  // "all" mode: the combined availability of every bookable employee, plus
  // which of them actually covers each resulting slot — needed below, since
  // a slot two or more of them share still requires the customer to pick
  // one, never an automatic assignment.
  let slots: AvailabilitySlot[];
  let candidateIdsByStart: Map<string, string[]> | undefined;

  if (employee === "all") {
    const perEmployee = await Promise.all(
      bookableEmployees.map((e) =>
        getAvailability({
          businessSlug: slug,
          employeeId: e.id,
          serviceId: selectedService.id,
          date: validDate,
        })
          .then((result) => ({ employeeId: e.id, slots: result.slots }))
          .catch((error: unknown) => {
            if (error instanceof ApiError && error.status === 404) {
              notFound();
            }
            throw error;
          }),
      ),
    );

    const byStart = new Map<string, AvailabilitySlot>();
    candidateIdsByStart = new Map();
    for (const { employeeId, slots: employeeSlots } of perEmployee) {
      for (const slot of employeeSlots) {
        if (!byStart.has(slot.start_time)) byStart.set(slot.start_time, slot);
        const ids = candidateIdsByStart.get(slot.start_time) ?? [];
        ids.push(employeeId);
        candidateIdsByStart.set(slot.start_time, ids);
      }
    }
    slots = [...byStart.values()].sort((a, b) =>
      a.start_time.localeCompare(b.start_time),
    );
  } else {
    const availability = await getAvailability({
      businessSlug: slug,
      employeeId: employee.id,
      serviceId: selectedService.id,
      date: validDate,
    }).catch((error: unknown) => {
      // The employee or service could have been deactivated between an
      // earlier step and this one; treat that the same as a bad link.
      if (error instanceof ApiError && error.status === 404) {
        notFound();
      }
      throw error;
    });
    slots = availability.slots;
  }

  const selectedSlot = timeParam
    ? slots.find((s) => s.start_time === timeParam)
    : undefined;

  if (!selectedSlot) {
    return (
      <TimeSelectionStep
        slug={slug}
        business={business}
        service={selectedService}
        employee={employee}
        date={validDate}
        slots={slots}
        backHref={dateBackHref}
        slotTaken={noticeParam === "slot-taken"}
      />
    );
  }

  if (employee === "all") {
    const candidateIds = candidateIdsByStart?.get(selectedSlot.start_time) ?? [];
    const candidates = bookableEmployees.filter((e) => candidateIds.includes(e.id));

    // Only one of them actually has this exact time free — nothing to ask,
    // so this just becomes the same URL a direct pick of that employee
    // would have produced.
    if (candidates.length === 1) {
      redirect({
        href: stepUrl(slug, {
          service: selectedService.id,
          employee: candidates[0].id,
          date: validDate,
          time: selectedSlot.start_time,
        }),
        locale,
      });
    }

    return (
      <EmployeeDisambiguationStep
        slug={slug}
        business={business}
        service={selectedService}
        date={validDate}
        slot={selectedSlot}
        candidates={candidates}
      />
    );
  }

  const timeBackHref = stepUrl(slug, {
    service: selectedService.id,
    employee: employee.id,
    date: validDate,
  });

  return (
    <ContactFormStep
      business={business}
      service={selectedService}
      employee={employee}
      date={validDate}
      slot={selectedSlot}
      backHref={timeBackHref}
    />
  );
}

function BusinessHeader({ business }: { business: PublicBusiness }) {
  return (
    <header className="flex flex-col items-center gap-2 text-center">
      <div
        aria-hidden
        className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-full text-lg font-semibold"
      >
        {business.name.charAt(0).toUpperCase()}
      </div>
      <h1 className="text-xl font-semibold">{business.name}</h1>
      <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1">
          <Phone className="size-3.5" />
          {business.phone}
        </span>
        {business.email && (
          <span className="inline-flex items-center gap-1">
            <Mail className="size-3.5" />
            {business.email}
          </span>
        )}
        {business.address && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" />
            {business.address}
          </span>
        )}
      </div>
    </header>
  );
}

function ServiceList({
  slug,
  services,
  currencySymbol,
}: {
  slug: string;
  services: PublicService[];
  currencySymbol: string;
}) {
  const t = useTranslations("Booking");
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-muted-foreground text-sm font-medium">
        {t("services")}
      </h2>
      {services.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noServices")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {services.map((service) => {
            const price = formatPrice(service.price, currencySymbol);
            return (
              <Card key={service.id}>
                <CardHeader>
                  <CardTitle>{service.name}</CardTitle>
                  {service.description && (
                    <CardDescription>{service.description}</CardDescription>
                  )}
                  <CardAction>
                    <Badge variant="secondary">
                      {formatDuration(service.duration_minutes)}
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-sm">
                    {price ?? ""}
                  </span>
                  <Link
                    href={stepUrl(slug, { service: service.id })}
                    className={buttonVariants({ size: "sm" })}
                  >
                    {t("reserve")}
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StepHeader({
  business,
  backHref,
}: {
  business: PublicBusiness;
  backHref: string;
}) {
  const t = useTranslations("Booking");
  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        href={backHref}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {t("back")}
      </Link>
      <span className="text-muted-foreground text-sm">{business.name}</span>
    </div>
  );
}

/**
 * A persistent recap of the selections made so far, shown on every step
 * from employee selection onward so the customer never loses track of what
 * they're booking.
 */
function BookingSummary({
  service,
  employee,
  date,
  time,
  timezone,
}: {
  service: PublicService;
  employee?: PublicEmployee | "all";
  date?: string;
  time?: string;
  timezone: string;
}) {
  const t = useTranslations("Booking");
  const locale = toIntlLocale(useLocale());
  const parts = [
    service.name,
    employee &&
      (employee === "all" ? t("allProfessionals") : t("withEmployee", { name: employee.name })),
    date && formatDate(date, locale),
    time && formatTime(time, timezone, locale),
  ].filter((part): part is string => Boolean(part));

  return (
    <div className="space-y-1 text-center">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {t("summaryLabel")}
      </p>
      <p className="text-sm">
        {parts.map((part, i) => (
          <span key={i}>
            {i > 0 && <span className="text-muted-foreground"> · </span>}
            <span
              className={i === 0 ? "font-semibold" : "text-muted-foreground"}
            >
              {part}
            </span>
          </span>
        ))}
      </p>
    </div>
  );
}

function EmployeeSelectionStep({
  slug,
  business,
  service,
  employees,
}: {
  slug: string;
  business: PublicBusiness;
  service: PublicService;
  employees: PublicEmployee[];
}) {
  const t = useTranslations("Booking");
  return (
    <div className="flex flex-col gap-6 p-6">
      <StepHeader business={business} backHref={stepUrl(slug, {})} />

      <BookingSummary service={service} timezone={business.timezone} />

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-sm font-medium">
          {t("chooseEmployee")}
        </h2>
        <div className="flex flex-col gap-3">
          <Link
            href={stepUrl(slug, {
              service: service.id,
              employee: ANY_EMPLOYEE_ID,
            })}
            className={cn(
              buttonVariants({ variant: "secondary" }),
              "justify-start gap-2",
            )}
          >
            <Users className="size-4" />
            {t("allProfessionals")}
          </Link>
          {employees.map((employee) => (
            <Link
              key={employee.id}
              href={stepUrl(slug, {
                service: service.id,
                employee: employee.id,
              })}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "justify-start",
              )}
            >
              {employee.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function NoEmployeesStep({ business }: { business: PublicBusiness }) {
  const t = useTranslations("Booking");
  return (
    <div className="flex flex-col gap-6 p-6">
      <StepHeader business={business} backHref={`/${business.slug}`} />
      <p className="text-muted-foreground text-center text-sm">
        {t("noEmployees")}
      </p>
    </div>
  );
}

/** Shown when the business has staff, but none of them are associated with the chosen service — distinct from NoEmployeesStep, which is the whole-business case. */
function NoEmployeesForServiceStep({
  slug,
  business,
  service,
}: {
  slug: string;
  business: PublicBusiness;
  service: PublicService;
}) {
  const t = useTranslations("Booking");
  return (
    <div className="flex flex-col gap-6 p-6">
      <StepHeader business={business} backHref={stepUrl(slug, {})} />
      <BookingSummary service={service} timezone={business.timezone} />
      <p className="text-muted-foreground text-center text-sm">
        {t("noEmployeesForService")}
      </p>
    </div>
  );
}

function DateSelectionStep({
  slug,
  business,
  service,
  employee,
  backHref,
  monthParam,
  today,
}: {
  slug: string;
  business: PublicBusiness;
  service: PublicService;
  employee: PublicEmployee | "all";
  backHref: string;
  monthParam: string | undefined;
  today: string;
}) {
  const t = useTranslations("Booking");
  const locale = toIntlLocale(useLocale());
  const current = parseMonthParam(monthParam, today);
  const grid = buildMonthGrid(current);
  const prev = shiftMonth(current, -1);
  const next = shiftMonth(current, 1);
  const todayMonth = today.slice(0, 7);
  const canGoPrev = formatMonthParam(prev) >= todayMonth;

  const dayLinkParams = {
    service: service.id,
    employee: employee === "all" ? ANY_EMPLOYEE_ID : employee.id,
    month: formatMonthParam(current),
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <StepHeader business={business} backHref={backHref} />

      <BookingSummary
        service={service}
        employee={employee}
        timezone={business.timezone}
      />

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          {canGoPrev ? (
            <Link
              href={stepUrl(slug, {
                ...dayLinkParams,
                month: formatMonthParam(prev),
              })}
              aria-label={t("previousMonth")}
              className={buttonVariants({
                variant: "outline",
                size: "icon-sm",
              })}
            >
              <ChevronLeft className="size-4" />
            </Link>
          ) : (
            <span
              className={cn(
                buttonVariants({ variant: "outline", size: "icon-sm" }),
                "opacity-40",
              )}
              aria-hidden
            >
              <ChevronLeft className="size-4" />
            </span>
          )}
          <h2 className="text-sm font-medium">
            {monthLabel(current, locale)}
          </h2>
          <Link
            href={stepUrl(slug, {
              ...dayLinkParams,
              month: formatMonthParam(next),
            })}
            aria-label={t("nextMonth")}
            className={buttonVariants({ variant: "outline", size: "icon-sm" })}
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdayLabels(locale).map((day, i) => (
            <span
              key={i}
              className="text-muted-foreground text-xs font-medium"
            >
              {day}
            </span>
          ))}
          {grid.flat().map((date, i) =>
            date === null ? (
              <span key={i} />
            ) : date < today ? (
              <span
                key={date}
                aria-hidden
                className="text-muted-foreground/40 flex aspect-square items-center justify-center text-sm"
              >
                {Number(date.slice(-2))}
              </span>
            ) : (
              <Link
                key={date}
                href={stepUrl(slug, { ...dayLinkParams, date })}
                className="hover:bg-muted flex aspect-square items-center justify-center rounded-full text-sm font-medium"
              >
                {Number(date.slice(-2))}
              </Link>
            ),
          )}
        </div>
      </section>
    </div>
  );
}

function TimeSelectionStep({
  slug,
  business,
  service,
  employee,
  date,
  slots,
  backHref,
  slotTaken,
}: {
  slug: string;
  business: PublicBusiness;
  service: PublicService;
  employee: PublicEmployee | "all";
  date: string;
  slots: AvailabilitySlot[];
  backHref: string;
  slotTaken: boolean;
}) {
  const t = useTranslations("Booking");
  return (
    <div className="flex flex-col gap-6 p-6">
      <StepHeader business={business} backHref={backHref} />

      {slotTaken && (
        <p className="bg-destructive/10 text-destructive rounded-lg p-3 text-center text-sm">
          {t("slotTaken")}
        </p>
      )}

      <BookingSummary
        service={service}
        employee={employee}
        date={date}
        timezone={business.timezone}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-sm font-medium">
          {t("chooseTime")}
        </h2>
        {slots.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noTimes")}</p>
        ) : (
          <TimeSlotPicker
            slug={slug}
            serviceId={service.id}
            employeeId={employee === "all" ? ANY_EMPLOYEE_ID : employee.id}
            date={date}
            timezone={business.timezone}
            slots={slots}
          />
        )}
      </section>
    </div>
  );
}

/**
 * Shown when the customer picked "Todos los profesionales" and the exact
 * time they chose is covered by more than one of them — the one place in
 * this flow where a professional still has to be picked explicitly, since
 * nobody is ever auto-assigned.
 */
function EmployeeDisambiguationStep({
  slug,
  business,
  service,
  date,
  slot,
  candidates,
}: {
  slug: string;
  business: PublicBusiness;
  service: PublicService;
  date: string;
  slot: AvailabilitySlot;
  candidates: PublicEmployee[];
}) {
  const t = useTranslations("Booking");
  return (
    <div className="flex flex-col gap-6 p-6">
      <StepHeader
        business={business}
        backHref={stepUrl(slug, {
          service: service.id,
          employee: ANY_EMPLOYEE_ID,
          date,
        })}
      />

      <BookingSummary
        service={service}
        date={date}
        time={slot.start_time}
        timezone={business.timezone}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-sm font-medium">
          {t("chooseEmployeeForSlot")}
        </h2>
        <div className="flex flex-col gap-3">
          {candidates.map((candidate) => (
            <Link
              key={candidate.id}
              href={stepUrl(slug, {
                service: service.id,
                employee: candidate.id,
                date,
                time: slot.start_time,
              })}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "justify-start",
              )}
            >
              {candidate.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * Confirms the chosen service, employee, date, and time, and collects the
 * customer's contact info before actually booking the appointment.
 */
function ContactFormStep({
  business,
  service,
  employee,
  date,
  slot,
  backHref,
}: {
  business: PublicBusiness;
  service: PublicService;
  employee: PublicEmployee;
  date: string;
  slot: AvailabilitySlot;
  backHref: string;
}) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <StepHeader business={business} backHref={backHref} />

      <BookingSummary
        service={service}
        employee={employee}
        date={date}
        time={slot.start_time}
        timezone={business.timezone}
      />

      <ContactForm
        business={business}
        service={service}
        employee={employee}
        date={date}
        slot={slot}
      />
    </div>
  );
}
