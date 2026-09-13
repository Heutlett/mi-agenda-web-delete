"use client";

import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  ChevronDown,
  Clock,
  ExternalLink,
  MessageCircle,
  Pencil,
  Phone,
  Repeat,
  Scissors,
  User,
  Wallet,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

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
import { Spinner } from "@/components/ui/spinner";
import { Link, useRouter } from "@/i18n/navigation";
import {
  type AppointmentDetail,
  type AppointmentStatus,
  type PaymentStatus,
  getAppointmentDetail,
  updateAppointment,
} from "@/lib/api/appointments";
import { ApiError } from "@/lib/api/client";
import { notifyAppointmentChanged } from "@/lib/appointment-events";
import { formatClockTime, formatFullDate, localDateKey, toIntlLocale } from "@/lib/date";
import { DEFAULT_CURRENCY_SYMBOL, formatDuration, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useBusinessSettings } from "../../business-context";
import { dayNames } from "../../schedules/schedule-form";
import { hasPermission, useSession } from "../../session-context";
import { STATUS_ICON, StatusBadge, statusLabel } from "../appointments-view";

/** wa.me link for a customer's already-normalized phone (see mi-agenda-api's internal/phone), no country-code handling needed here unlike the public booking form's own business-phone link. */
function customerWhatsAppLink(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

// Every status an appointment can be set to, in the order their buttons
// appear.
const ALL_STATUSES: AppointmentStatus[] = [
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "MISSED",
];

// A CANCELLED or MISSED appointment was never actually rendered, so the
// backend forces its price to 0 and payment_status to NOT_APPLICABLE
// regardless of what's requested — see mi-agenda-api's update.go. The
// frontend mirrors that by locking both fields whenever one of these is
// the effective status (saved, or a not-yet-saved pending pick).
function isNoChargeStatus(status: AppointmentStatus): boolean {
  return status === "CANCELLED" || status === "MISSED";
}

// Applied to whichever element currently provides the card-like chrome
// (the inner Card in page mode, DialogContent itself in modal mode) while
// there's an unsaved edit, so it's visible either way.
const UNSAVED_CHANGES_GLOW =
  "border-amber-400 shadow-[0_0_20px_-4px_rgba(251,191,36,0.6)] ring-2 ring-amber-400/40 ring-offset-2 ring-offset-background dark:border-amber-500";

// Mirrors StatusBadge's own STATUS_VARIANT colors (info/success/destructive/warning): applied to whichever status button is currently active (the appointment's saved status, or a pending selection once one is picked), so it reads as the same color as its badge everywhere else. The other buttons stay plain outline.
const STATUS_ACTIVE_CLASSES: Record<AppointmentStatus, string> = {
  CONFIRMED: "bg-blue-500/10 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400",
  COMPLETED: "bg-green-600/10 text-green-700 dark:bg-green-400/10 dark:text-green-400",
  CANCELLED: "bg-red-600/10 text-red-700 dark:bg-red-400/10 dark:text-red-400",
  MISSED:
    "bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400",
};

const ALL_PAYMENT_STATUSES: PaymentStatus[] = [
  "PENDING",
  "PAID",
  "OVERDUE",
  "NOT_APPLICABLE",
];

// OVERDUE ("moroso") or NOT_APPLICABLE ("no aplica pago") forces an
// appointment's price to 0, mirroring the backend's own
// paymentStatusForcesZeroPrice (see mi-agenda-api's update.go): an overdue
// balance is written off rather than carried as a phantom receivable, and
// NOT_APPLICABLE means no charge was ever expected.
function paymentStatusForcesZeroPrice(status: PaymentStatus): boolean {
  return status === "OVERDUE" || status === "NOT_APPLICABLE";
}

const PAYMENT_STATUS_LABEL_KEY: Record<PaymentStatus, string> = {
  PAID: "paymentStatusPaid",
  PENDING: "paymentStatusPending",
  OVERDUE: "paymentStatusOverdue",
  NOT_APPLICABLE: "paymentStatusNotApplicable",
};

const PAYMENT_STATUS_CLASSES: Record<PaymentStatus, string> = {
  PAID: "bg-green-600/10 text-green-700 dark:bg-green-400/10 dark:text-green-400",
  PENDING:
    "bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400",
  OVERDUE:
    "bg-red-600/10 text-red-700 dark:bg-red-400/10 dark:text-red-400",
  // A plain black/white look, deliberately distinct from bg-muted (the
  // locked/disabled chip's own color) so a selected "No aplica pago" never
  // reads as if the dropdown itself were locked.
  NOT_APPLICABLE:
    "bg-white text-black border border-neutral-300 dark:bg-black dark:text-white dark:border-neutral-700",
};

/**
 * Maps PATCH /appointments/{id}'s two distinct 409 reasons to a
 * translated message: reviving a CANCELLED appointment whose slot was
 * taken by someone else (see mi-agenda-api's update.go) is a different,
 * more actionable situation than the original "already moved elsewhere"
 * conflict, so it gets its own message rather than collapsing into one
 * generic "reload" message.
 */
function statusChangeErrorMessage(
  err: unknown,
  t: (key: string) => string,
  tc: (key: string) => string,
): string {
  if (!(err instanceof ApiError)) return tc("genericErrorRetry");
  if (err.status === 409) {
    return err.message === "that time is no longer available"
      ? t("statusChangeSlotTakenError")
      : t("conflictError");
  }
  return err.message;
}

// "original" reverts to the price actually captured at booking time,
// selectable only once it differs from both "default" and "unpaid" (a
// genuine custom amount) — see priceOptions below.
type PriceSelection = "default" | "unpaid" | "original" | "custom" | null;
type PaymentStatusSelection = PaymentStatus | null;

/**
 * The discrete price options to offer in the dropdown, deduped by value
 * (e.g. if the service's default price happens to be 0, "unpaid" is
 * dropped rather than repeating "default"). Includes "original" — the
 * price actually captured at booking, if it's a distinct amount from both
 * — so picking another option first never strands the user without a way
 * back to it besides Cancelar.
 */
function priceOptions(
  appointment: AppointmentDetail,
): { tag: "default" | "unpaid" | "original"; value: number }[] {
  const candidates: { tag: "default" | "unpaid" | "original"; value: number }[] =
    [
      { tag: "default", value: appointment.service.price },
      { tag: "unpaid", value: 0 },
    ];
  if (appointment.price != null) {
    candidates.push({ tag: "original", value: appointment.price });
  }

  const seen = new Set<number>();
  return candidates.filter(({ value }) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

/** The decimal string a pending price selection resolves to, ready for PATCH /appointments/{id} — null if nothing is selected. */
function resolvedPriceValue(
  appointment: AppointmentDetail,
  selection: PriceSelection,
  input: string,
): string | null {
  if (selection === "default") return String(appointment.service.price);
  if (selection === "unpaid") return "0";
  if (selection === "original") {
    return String(appointment.price ?? appointment.service.price);
  }
  if (selection === "custom") return input;
  return null;
}

/** Formats a pending price value for the confirmation summary; falls back to the raw string for a custom amount that isn't parseable yet, rather than showing "NaN". */
function formatPendingPrice(value: string, currencySymbol: string): string {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return formatPrice(numeric, currencySymbol) ?? value;
}

/** A labeled divider introducing one of the card's sections (client, details, status): a small caption trailing into a hairline. dirty shows a small pencil next to the label when that section has an actual pending change. */
function SectionHeader({
  dirty,
  children,
}: {
  dirty?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px] font-semibold tracking-wider uppercase">
        {children}
        {dirty && <Pencil className="size-3" />}
      </span>
      <div className="bg-border h-px flex-1" />
    </div>
  );
}

/** A colored pill for a payment status, the same shape as StatusBadge but for PAID/PENDING/OVERDUE — so the confirmation summary shows a payment-status change with the same at-a-glance color coding as its chip. */
function PaymentStatusBadge({
  status,
  t,
}: {
  status: PaymentStatus;
  t: (key: string) => string;
}) {
  return (
    <Badge className={cn("border-transparent", PAYMENT_STATUS_CLASSES[status])}>
      {t(PAYMENT_STATUS_LABEL_KEY[status])}
    </Badge>
  );
}

/**
 * The appointment detail view: full editing logic for status, price, and
 * payment status, unchanged regardless of how it's presented. Rendered as
 * a plain page by appointments/[id]/page.tsx (direct URL, hard refresh)
 * and as a modal over whatever admin page is currently showing by
 * admin/@modal/(.)appointments/[id]/page.tsx (an in-app click) — asModal
 * only changes the outer shell; every editing behavior, including the
 * unsaved-changes guard, is identical either way.
 */
export function AppointmentDetailContent({ asModal }: { asModal: boolean }) {
  const t = useTranslations("Appointments");
  const tc = useTranslations("Common");
  const session = useSession();
  const { business } = useBusinessSettings();
  const currencySymbol = business?.currency_symbol ?? DEFAULT_CURRENCY_SYMBOL;
  const router = useRouter();
  const locale = toIntlLocale(useLocale());
  const { id } = useParams<{ id: string }>();
  const [appointment, setAppointment] = useState<AppointmentDetail | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [priceSelection, setPriceSelection] = useState<PriceSelection>(null);
  const [priceInput, setPriceInput] = useState("");
  const [paymentStatusSelection, setPaymentStatusSelection] =
    useState<PaymentStatusSelection>(null);
  const [statusSelection, setStatusSelection] =
    useState<AppointmentStatus | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paymentStatusLocked, setPaymentStatusLocked] = useState(false);
  const [priceLocked, setPriceLocked] = useState(false);
  const [statusOverrideOpen, setStatusOverrideOpen] = useState(false);
  const [statusOverrideTarget, setStatusOverrideTarget] =
    useState<AppointmentStatus | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);

  // A selection only counts as an actual change once it differs from what's
  // already saved — picking the same value back (every option stays
  // selectable, including the current one) must not enter edit mode.
  // "custom" is the one exception: it always means an in-progress typed
  // amount, judged only once Guardar is actually pressed.
  const currentPriceValue = appointment
    ? (appointment.price ?? appointment.service.price)
    : null;
  const resolvedPrice = appointment
    ? resolvedPriceValue(appointment, priceSelection, priceInput)
    : null;
  const isPriceDirty =
    priceSelection !== null &&
    (priceSelection === "custom" ||
      (resolvedPrice !== null && Number(resolvedPrice) !== currentPriceValue));
  const isPaymentStatusDirty =
    paymentStatusSelection !== null &&
    paymentStatusSelection !== appointment?.payment_status;
  const isStatusDirty =
    statusSelection !== null && statusSelection !== appointment?.status;

  // The tag matching the currently saved price, so the select shows it
  // directly as a real, already-selected option — no disabled placeholder
  // needed now that every option stays selectable.
  const currentPriceTag = appointment
    ? (priceOptions(appointment).find(({ value }) => value === currentPriceValue)
        ?.tag ?? null)
    : null;

  // The status a save would actually apply: a pending pick, or the saved
  // one if nothing's pending. Price/payment-status editability is gated on
  // this, not just the saved status, so picking COMPLETED enables the
  // payment-status field immediately, before Guardar is ever pressed.
  const effectiveStatus = statusSelection ?? appointment?.status ?? null;
  const isNoCharge = effectiveStatus !== null && isNoChargeStatus(effectiveStatus);
  const canEditPaymentStatus = effectiveStatus === "COMPLETED";

  // The payment status a save would actually apply, and whether it forces
  // price to 0 on its own (independent of isNoCharge above, which is
  // driven by appointment status instead). isNoCharge already implies a
  // forced price of 0 too (the backend's status-driven force takes
  // precedence over the payment-status-driven one), so this only adds a
  // second, independent path to the same outcome.
  const effectivePaymentStatus =
    paymentStatusSelection ?? appointment?.payment_status ?? null;
  const paymentForcesZeroPrice =
    effectivePaymentStatus !== null &&
    paymentStatusForcesZeroPrice(effectivePaymentStatus);
  const isPriceForcedZero = isNoCharge || paymentForcesZeroPrice;
  // Price counts as changing even without an explicit pick whenever a
  // forcing rule would actually move it away from its current value —
  // otherwise picking a status/payment-status that forces 0 while the
  // price already happens to be 0 would wrongly flag it as a change.
  const priceForceChangesValue = isPriceForcedZero && currentPriceValue !== 0;

  const hasUnsavedChanges =
    isPriceDirty ||
    isPaymentStatusDirty ||
    isStatusDirty ||
    priceForceChangesValue;

  // Each lock warning shows only while its own reason still applies —
  // e.g. picking a different payment status un-locks price, and the
  // "always zero while Moroso/No aplica pago" warning must vanish right
  // along with it, not linger until some unrelated action clears it. The
  // click handlers below only ever set these true; whether they're still
  // showing is judged fresh on every render instead.
  const showPriceLockedWarning = priceLocked && isPriceForcedZero;
  const showPaymentStatusLockedWarning = paymentStatusLocked && !canEditPaymentStatus;

  // Warns before an actual tab close/reload/URL-bar navigation while a
  // selection hasn't been saved yet; in-app navigation (the back button,
  // the customer link) is instead routed through guardedNavigate below,
  // which shows the app's own styled confirmation dialog.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    let cancelled = false;

    getAppointmentDetail(id)
      .then((detail) => {
        if (!cancelled) setAppointment(detail);
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

    return () => {
      cancelled = true;
    };
  }, [id, t]);

  function selectPriceOption(value: string) {
    if (
      value === "default" ||
      value === "unpaid" ||
      value === "original" ||
      value === "custom"
    ) {
      setPriceSelection(value);
      setSaveError(null);
      if (value === "custom") setPriceInput("");
    }
  }

  function selectPaymentStatusOption(value: string) {
    if (
      value === "PAID" ||
      value === "PENDING" ||
      value === "OVERDUE" ||
      value === "NOT_APPLICABLE"
    ) {
      setPaymentStatusSelection(value);
      setSaveError(null);
      // OVERDUE/NOT_APPLICABLE forces price to 0 (see
      // paymentStatusForcesZeroPrice): clear a pending price pick, since
      // it's about to be overridden anyway and the price chip is about to
      // visibly flip to a locked "0.00" right next to this one.
      if (paymentStatusForcesZeroPrice(value)) {
        setPriceSelection(null);
        setPriceInput("");
      }
    }
  }

  /** Payment status only reflects an actual charge once the (effective) status is COMPLETED, so it's only editable then; clicking it otherwise surfaces a warning instead of silently doing nothing. */
  function handlePaymentStatusChipClick() {
    if (!canEditPaymentStatus) setPaymentStatusLocked(true);
  }

  /** Price is never editable once it's forced to 0 — a cancelled/missed appointment, or one whose payment status is overdue/not-applicable; clicking it surfaces why instead of silently doing nothing. */
  function handlePriceChipClick() {
    if (isPriceForcedZero) setPriceLocked(true);
  }

  /**
   * Picks status as the pending status change, or clears a pending one if
   * status is already the appointment's saved status — the "static button
   * per status" equivalent of the price/payment-status dropdowns' own
   * select/deselect behavior. If a pending price or payment-status pick
   * would stop making sense under the new status (moving away from
   * COMPLETED invalidates a payment-status pick; moving into
   * CANCELLED/MISSED invalidates a price pick, forced to 0 instead), warns
   * before discarding it rather than doing so silently.
   */
  function toggleStatusOption(status: AppointmentStatus) {
    if (!appointment) return;
    const nextSelection = status === appointment.status ? null : status;
    const currentEffectiveStatus = statusSelection ?? appointment.status;
    const losingPaymentEdit =
      paymentStatusSelection !== null &&
      currentEffectiveStatus === "COMPLETED" &&
      status !== "COMPLETED";
    const losingPriceEdit = priceSelection !== null && isNoChargeStatus(status);

    if (losingPaymentEdit || losingPriceEdit) {
      setStatusOverrideTarget(nextSelection);
      setStatusOverrideOpen(true);
      return;
    }

    applyStatusSelection(nextSelection);
  }

  function applyStatusSelection(nextSelection: AppointmentStatus | null) {
    setStatusSelection(nextSelection);
    setSaveError(null);
  }

  /** Confirms discarding a now-invalid price/payment-status pick in favor of the newly picked status — see toggleStatusOption. */
  function confirmStatusOverride() {
    applyStatusSelection(statusOverrideTarget);
    setPaymentStatusSelection(null);
    setPriceSelection(null);
    setPriceInput("");
    setStatusOverrideOpen(false);
  }

  function cancelChanges() {
    setPriceSelection(null);
    setPriceInput("");
    setPaymentStatusSelection(null);
    setStatusSelection(null);
    setSaveError(null);
  }

  /** Opens the confirmation dialog summarizing every pending change, rather than saving straight away — see confirmChanges. */
  function requestSave() {
    if (!hasUnsavedChanges) return;
    setConfirmOpen(true);
  }

  /**
   * Saves whichever of priceSelection/paymentStatusSelection/statusSelection
   * is pending in one combined PATCH /appointments/{id} call, never more
   * than one — the backend already accepts all three together in a single
   * request. Only reachable from the confirmation dialog opened by
   * requestSave.
   */
  async function confirmChanges() {
    if (!hasUnsavedChanges || !appointment) return;

    const params: {
      status?: AppointmentStatus;
      price?: string;
      payment_status?: PaymentStatus;
    } = {};
    if (isStatusDirty && statusSelection) params.status = statusSelection;
    if (isPriceDirty && resolvedPrice !== null) params.price = resolvedPrice;
    else if (priceForceChangesValue) params.price = "0";
    if (isPaymentStatusDirty && paymentStatusSelection) {
      params.payment_status = paymentStatusSelection;
    }

    setSaveBusy(true);
    setSaveError(null);
    try {
      const updated = await updateAppointment(id, params);
      setConfirmOpen(false);
      setAppointment((current) =>
        current
          ? {
              ...current,
              status: updated.status,
              price: updated.price,
              payment_status: updated.payment_status,
            }
          : current,
      );
      notifyAppointmentChanged();
      setPriceSelection(null);
      setPriceInput("");
      setPaymentStatusSelection(null);
      setStatusSelection(null);
    } catch (err) {
      setConfirmOpen(false);
      setSaveError(
        isStatusDirty
          ? statusChangeErrorMessage(err, t, tc)
          : err instanceof ApiError && err.status === 400
            ? t("invalidPrice")
            : tc("genericErrorRetry"),
      );
    } finally {
      setSaveBusy(false);
    }
  }

  /**
   * Routes an in-page navigation (back button, customer link, or — in
   * modal mode — the Dialog's X/Escape/backdrop close) through the
   * unsaved-change guard: an unsaved dropdown selection hasn't been
   * committed yet, so leaving now would silently drop it.
   */
  function guardedNavigate(action: () => void) {
    if (hasUnsavedChanges) {
      setPendingNavigation(() => action);
      return;
    }
    action();
  }

  function discardChangesAndNavigate() {
    const action = pendingNavigation;
    setPendingNavigation(null);
    cancelChanges();
    action?.();
  }

  const canEditAnytime = hasPermission(session, "edit_appointment_status");
  // Without the permission, status can only ever be changed away from
  // CONFIRMED (the original one-way behavior) — never revisited once
  // already CANCELLED/COMPLETED/MISSED.
  const canChangeStatus =
    !!appointment && (canEditAnytime || appointment.status === "CONFIRMED");
  const availableStatuses =
    appointment && canChangeStatus
      ? ALL_STATUSES.filter((status) => status !== appointment.status)
      : [];

  // In modal mode, DialogContent already provides the card-like chrome
  // (background, ring, rounded corners), so the inner Card would just
  // double it up as a redundant nested border. Swapping both to plain
  // divs there lets DialogContent be the only chrome, while page mode
  // keeps the real Card exactly as before.
  const Wrapper = asModal ? "div" : Card;
  const WrapperContent = asModal ? "div" : CardContent;

  const detail = (
    <>
      {error && <p className="text-destructive text-sm">{error}</p>}

      {!error && !appointment && (
        <div className="flex justify-center p-6">
          <Spinner className="size-6" />
        </div>
      )}

      {appointment && (
        <Wrapper
          className={cn(
            !asModal && "transition-shadow duration-300",
            !asModal && hasUnsavedChanges && UNSAVED_CHANGES_GLOW,
          )}
        >
          <WrapperContent className="flex flex-col gap-5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="text-lg font-semibold">
                  {formatFullDate(localDateKey(appointment.start_time), locale)}
                </h1>
                <p className="text-muted-foreground">
                  {formatClockTime(appointment.start_time, locale)} –{" "}
                  {formatClockTime(appointment.end_time, locale)}
                </p>
                {appointment.recurring_appointment && (
                  <Badge variant="secondary" className="mt-1.5">
                    <Repeat />
                    {t("recurringChip", {
                      day: dayNames(locale)[appointment.recurring_appointment.day_of_week],
                      time: appointment.recurring_appointment.start_time,
                      weeks: appointment.recurring_appointment.interval_weeks,
                    })}
                  </Badge>
                )}
              </div>
              {hasUnsavedChanges && (
                <Badge variant="warning" className="animate-pulse">
                  <Pencil />
                  {t("editingBadge")}
                </Badge>
              )}
            </div>

            <SectionHeader>{t("clientSectionTitle")}</SectionHeader>

            <section className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
                    <User className="size-4" />
                  </span>
                  <div className="flex flex-col">
                    {hasPermission(session, "view_customers") ? (
                      <Link
                        href={`/admin/customers/${appointment.customer.id}`}
                        onClick={(event) => {
                          if (!hasUnsavedChanges) return;
                          event.preventDefault();
                          guardedNavigate(() =>
                            router.push(
                              `/admin/customers/${appointment.customer.id}`,
                            ),
                          );
                        }}
                        className="inline-flex w-fit items-center gap-1 font-medium underline"
                      >
                        {appointment.customer.name}
                        <ExternalLink className="size-3.5" />
                      </Link>
                    ) : (
                      <p className="font-medium">
                        {appointment.customer.name}
                      </p>
                    )}
                    {appointment.customer.email && (
                      <p className="text-muted-foreground text-xs">
                        {appointment.customer.email}
                      </p>
                    )}
                  </div>
                </div>

                {appointment.customer.phone && (
                  <>
                    <div className="bg-border hidden h-8 w-px sm:block" />

                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground inline-flex items-center gap-1.5">
                        <Phone className="size-3.5" />
                        {appointment.customer.phone}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={
                          <a
                            href={customerWhatsAppLink(
                              appointment.customer.phone,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                      >
                        <MessageCircle className="text-green-600 dark:text-green-500" />
                        {t("messageOnWhatsApp")}
                      </Button>
                    </div>
                  </>
                )}
              </div>
              {appointment.notes && (
                <p className="text-muted-foreground text-xs">
                  {t("notes")}:{" "}
                  <span className="text-foreground">{appointment.notes}</span>
                </p>
              )}
            </section>

            <SectionHeader
              dirty={
                isPriceDirty || isPaymentStatusDirty || priceForceChangesValue
              }
            >
              {t("serviceSectionTitle")}
            </SectionHeader>

            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary">
                  <Scissors />
                  {appointment.service.name}
                </Badge>

                <Badge variant="secondary">
                  <Clock />
                  {formatDuration(appointment.service.duration_minutes)}
                </Badge>

                {isPriceForcedZero ? (
                  <div
                    className="relative inline-flex items-center rounded-full bg-muted py-0.5 pr-3 pl-6 text-xs font-medium text-muted-foreground opacity-70"
                    onClick={handlePriceChipClick}
                  >
                    <Banknote className="pointer-events-none absolute left-2 size-3 opacity-70" />
                    {formatPrice(0, currencySymbol)}
                  </div>
                ) : priceSelection === "custom" ? (
                  <div className="relative inline-flex items-center rounded-full bg-green-600/10 py-0.5 pr-3 pl-6 text-xs font-medium text-green-700 dark:bg-green-400/10 dark:text-green-400">
                    <Banknote className="pointer-events-none absolute left-2 size-3 opacity-70" />
                    <span className="mr-0.5">{currencySymbol}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoFocus
                      placeholder="0.00"
                      value={priceInput}
                      onChange={(event) => setPriceInput(event.target.value)}
                      className="w-14 bg-transparent outline-none placeholder:text-green-700/50 dark:placeholder:text-green-400/50"
                    />
                  </div>
                ) : (
                  <div className="relative inline-flex items-center">
                    <Banknote className="pointer-events-none absolute left-2 size-3 opacity-70" />
                    <select
                      value={priceSelection ?? currentPriceTag ?? ""}
                      onChange={(event) =>
                        selectPriceOption(event.target.value)
                      }
                      className="appearance-none rounded-full border-0 bg-green-600/10 py-0.5 pr-6 pl-6 text-xs font-medium text-green-700 outline-none dark:bg-green-400/10 dark:text-green-400"
                    >
                      {priceOptions(appointment).map(({ tag, value }) => (
                        <option key={tag} value={tag}>
                          {formatPrice(value, currencySymbol)}
                        </option>
                      ))}
                      <option value="custom">{t("priceOptionCustom")}</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-1.5 size-3 opacity-60" />
                  </div>
                )}

                {isNoCharge ? (
                  <div
                    className="relative inline-flex items-center rounded-full bg-muted py-0.5 pr-3 pl-6 text-xs font-medium text-muted-foreground opacity-70"
                    onClick={handlePaymentStatusChipClick}
                  >
                    <Wallet className="pointer-events-none absolute left-2 size-3 opacity-70" />
                    {t(PAYMENT_STATUS_LABEL_KEY.NOT_APPLICABLE)}
                  </div>
                ) : (
                  <div
                    className={cn(
                      "relative inline-flex items-center",
                      !canEditPaymentStatus && "opacity-50",
                    )}
                    onClick={handlePaymentStatusChipClick}
                  >
                    <Wallet className="pointer-events-none absolute left-2 size-3 opacity-70" />
                    <select
                      disabled={!canEditPaymentStatus}
                      value={paymentStatusSelection ?? appointment.payment_status}
                      onChange={(event) =>
                        selectPaymentStatusOption(event.target.value)
                      }
                      className={cn(
                        "appearance-none rounded-full border-0 py-0.5 pr-6 pl-6 text-xs font-medium outline-none",
                        PAYMENT_STATUS_CLASSES[
                          paymentStatusSelection ?? appointment.payment_status
                        ],
                        !canEditPaymentStatus && "pointer-events-none",
                      )}
                    >
                      {ALL_PAYMENT_STATUSES.map((option) => (
                        <option key={option} value={option}>
                          {t(PAYMENT_STATUS_LABEL_KEY[option])}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-1.5 size-3 opacity-60" />
                  </div>
                )}
              </div>
              {showPriceLockedWarning && (
                <p className="text-amber-600 text-xs dark:text-amber-400">
                  {isNoCharge
                    ? t("priceLockedWarning")
                    : t("priceLockedPaymentStatusWarning")}
                </p>
              )}
              {showPaymentStatusLockedWarning && (
                <p className="text-amber-600 text-xs dark:text-amber-400">
                  {isNoCharge
                    ? t("paymentStatusNotApplicableWarning")
                    : t("paymentStatusLockedWarning")}
                </p>
              )}
              {session.role === "admin" && (
                <p className="text-muted-foreground text-xs">
                  {t("employee")}:{" "}
                  <span className="text-foreground">
                    {appointment.employee.name}
                  </span>
                </p>
              )}
            </section>

            {availableStatuses.length > 0 && (
              <>
                <SectionHeader dirty={isStatusDirty}>
                  {t("actionsSectionTitle")}
                </SectionHeader>
                <section className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    {ALL_STATUSES.map((status) => {
                      const isCurrent = status === appointment.status;
                      const isActive =
                        (statusSelection ?? appointment.status) === status;
                      const StatusIcon = STATUS_ICON[status];
                      return (
                        <Button
                          key={status}
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            saveBusy ||
                            (!isCurrent && !availableStatuses.includes(status))
                          }
                          onClick={() => toggleStatusOption(status)}
                          className={
                            isActive
                              ? cn(
                                  "border-transparent",
                                  STATUS_ACTIVE_CLASSES[status],
                                )
                              : undefined
                          }
                        >
                          <StatusIcon />
                          {statusLabel(status, t)}
                        </Button>
                      );
                    })}
                  </div>
                </section>
              </>
            )}

            {hasUnsavedChanges && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    saveBusy ||
                    (priceSelection === "custom" && !priceInput.trim())
                  }
                  onClick={requestSave}
                >
                  {tc("save")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={cancelChanges}
                  disabled={saveBusy}
                >
                  {tc("cancel")}
                </Button>
              </div>
            )}
            {saveError && (
              <p className="text-destructive text-xs">{saveError}</p>
            )}
          </WrapperContent>
        </Wrapper>
      )}
    </>
  );

  return (
    <>
      {asModal ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) guardedNavigate(() => router.back());
          }}
        >
          <DialogContent
            className={cn(
              "max-h-[85vh] overflow-y-auto transition-shadow duration-300 sm:max-w-2xl",
              hasUnsavedChanges && UNSAVED_CHANGES_GLOW,
            )}
          >
            {detail}
          </DialogContent>
        </Dialog>
      ) : (
        <div className="flex max-w-lg flex-col gap-6 sm:max-w-2xl">
          {/*
            A real "go back," not a fixed link to the appointments list: this
            page is also reached from a customer's appointment history, and
            the origin should always be where a customer lands back.
          */}
          <button
            type="button"
            onClick={() => guardedNavigate(() => router.back())}
            className="self-start text-sm underline"
          >
            {t("backToAppointments")}
          </button>
          {detail}
        </div>
      )}

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) setConfirmOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("confirmChangesTitle")}</DialogTitle>
          </DialogHeader>

          {appointment && (
            <div className="flex flex-col gap-2 text-sm">
              {isStatusDirty && statusSelection && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {t("chipStatusLabel")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <StatusBadge status={appointment.status} t={t} />
                    <ArrowRight className="text-muted-foreground size-3.5" />
                    <StatusBadge status={statusSelection} t={t} />
                  </span>
                </div>
              )}
              {(isPriceDirty || priceForceChangesValue) && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {t("chipPriceLabel")}
                  </span>
                  <span>
                    {formatPrice(currentPriceValue, currencySymbol)}
                    {" → "}
                    {isPriceDirty
                      ? formatPendingPrice(resolvedPrice ?? "", currencySymbol)
                      : formatPrice(0, currencySymbol)}
                  </span>
                </div>
              )}
              {isPaymentStatusDirty && paymentStatusSelection && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {t("chipPaymentStatusLabel")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <PaymentStatusBadge
                      status={appointment.payment_status}
                      t={t}
                    />
                    <ArrowRight className="text-muted-foreground size-3.5" />
                    <PaymentStatusBadge status={paymentStatusSelection} t={t} />
                  </span>
                </div>
              )}
              {isStatusDirty &&
                statusSelection &&
                isNoChargeStatus(statusSelection) &&
                !isNoChargeStatus(appointment.status) &&
                appointment.payment_status !== "NOT_APPLICABLE" && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {t("chipPaymentStatusLabel")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <PaymentStatusBadge
                      status={appointment.payment_status}
                      t={t}
                    />
                    <ArrowRight className="text-muted-foreground size-3.5" />
                    <PaymentStatusBadge status="NOT_APPLICABLE" t={t} />
                  </span>
                </div>
              )}
            </div>
          )}

          {isStatusDirty &&
            statusSelection === "COMPLETED" &&
            appointment &&
            appointment.price == null && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                {t("noPriceUsesDefault", {
                  // Non-null: appointment.service.price is a number, and
                  // formatPrice only returns null for a null input.
                  price: formatPrice(
                    appointment.service.price,
                    currencySymbol,
                  )!,
                })}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(false)}
              disabled={saveBusy}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={confirmChanges}
              disabled={saveBusy}
            >
              {saveBusy ? tc("saving") : t("confirmChangesButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={statusOverrideOpen}
        onOpenChange={(open) => {
          if (!open) setStatusOverrideOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("statusOverrideWarningTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {t("statusOverrideWarningBody")}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStatusOverrideOpen(false)}
            >
              {tc("cancel")}
            </Button>
            <Button type="button" size="sm" onClick={confirmStatusOverride}>
              {t("statusOverrideWarningContinue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingNavigation !== null}
        onOpenChange={(open) => {
          if (!open) setPendingNavigation(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("unsavedPriceTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {t("unsavedPriceBody")}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPendingNavigation(null)}
            >
              {t("unsavedPriceStay")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={discardChangesAndNavigate}
            >
              {t("unsavedPriceDiscard")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
