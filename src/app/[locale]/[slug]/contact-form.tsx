"use client";

import { AlertTriangle, CheckCircle2, MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "@/i18n/navigation";
import { createAppointment, type Appointment } from "@/lib/api/appointments";
import type { AvailabilitySlot } from "@/lib/api/availability";
import type {
  PublicBusiness,
  PublicEmployee,
  PublicService,
} from "@/lib/api/business";
import { ApiError } from "@/lib/api/client";
import { lookupVerifiedCustomer } from "@/lib/api/phone-verification";
import { toIntlLocale } from "@/lib/date";
import { formatDuration, formatTime } from "@/lib/format";
import { digitsOnly, normalizePhone } from "./contact-form-phone";
import {
  type ContactFormErrors,
  type ContactFormValues,
  validateContactForm,
} from "./contact-form-validation";
import {
  PhoneVerification,
  type PhoneVerificationHandle,
} from "./phone-verification";
import { stepUrl } from "./step-url";

/** Minimum local-number digit count before a phone looks complete enough to look up. */
const MIN_PHONE_DIGITS = 8;

/**
 * A wa.me link to the business's own WhatsApp number, so a customer who
 * hits a booking error (limit reached, banned) has an immediate way to
 * reach out instead of a dead-end message — the most common client is on
 * their phone already, so this opens straight into a WhatsApp chat rather
 * than just displaying a number to dial.
 */
function businessWhatsAppLink(phone: string | null): string | null {
  if (!phone) return null;
  if (!digitsOnly(phone)) return null;
  return `https://wa.me/${normalizePhone(phone)}`;
}

interface BookingError {
  text: string;
  /** Whether this error is one a customer could resolve by reaching out directly. */
  showContact: boolean;
}

/**
 * Maps POST /appointments's plain-text booking-rejection reasons to a
 * translated message. mi-agenda-api's errors are plain text, not a
 * structured code (see ApiError's doc comment), so this matches on the
 * exact known strings and falls back to a generic message for anything
 * else — never shows the raw, untranslated API text to a customer.
 */
function bookingErrorMessage(
  error: unknown,
  t: (key: string) => string,
): BookingError {
  if (!(error instanceof ApiError)) {
    return { text: t("genericError"), showContact: false };
  }
  switch (error.message) {
    case "daily appointment limit reached":
      return { text: t("dailyLimitReached"), showContact: true };
    case "weekly appointment limit reached":
      return { text: t("weeklyLimitReached"), showContact: true };
    case "this customer is not able to book appointments":
      return { text: t("customerNotAllowed"), showContact: true };
    default:
      return { text: t("genericError"), showContact: false };
  }
}

/**
 * Client-side validated only, per design.md §12 — the backend re-validates
 * (and is the actual source of truth) when the appointment is booked.
 */
export function ContactForm({
  business,
  service,
  employee,
  date,
  slot,
}: {
  business: PublicBusiness;
  service: PublicService;
  employee: PublicEmployee;
  date: string;
  slot: AvailabilitySlot;
}) {
  const router = useRouter();
  const t = useTranslations("ContactForm");
  const tv = useTranslations("Validation");
  const tf = useTranslations("FoundCustomer");
  const tp = useTranslations("PhoneVerification");
  const locale = toIntlLocale(useLocale());
  const [values, setValues] = useState<ContactFormValues>({
    name: "",
    phone: "",
  });
  const fullPhone = normalizePhone(values.phone);
  const whatsAppLink = businessWhatsAppLink(business.phone);
  const [errors, setErrors] = useState<ContactFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<BookingError | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);

  // Verification is required to book, and never carries over to a
  // different phone number — see the "always re-verify" rationale on
  // PhoneVerification. Reset the moment the phone value itself changes.
  const [phoneVerified, setPhoneVerified] = useState(false);
  const phoneVerificationRef = useRef<PhoneVerificationHandle>(null);

  // Shown once the name field gets auto-filled from a prior booking, so
  // the customer knows why it's not blank and that they can still change
  // it. Independent of verification — it's a convenience, not a security
  // control.
  const [nameWasFilled, setNameWasFilled] = useState(false);

  function updateField(field: keyof ContactFormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    if (field === "name") setNameWasFilled(false);
  }

  function updatePhone(value: string) {
    updateField("phone", value);
    setPhoneVerified(false);
  }

  // Looks up whether this phone has saved, verified customer data from a
  // prior booking, once it looks complete enough, and fills the name field
  // in directly. Never overwrites anything the customer already typed.
  useEffect(() => {
    if (digitsOnly(values.phone).length < MIN_PHONE_DIGITS) return;
    const phone = fullPhone;

    const timeout = setTimeout(() => {
      lookupVerifiedCustomer({ businessSlug: business.slug, phone })
        .then((result) => {
          if (!result.found) return;
          // Best-effort convenience: never overwrite a name the customer
          // has already typed by the time this resolves.
          if (values.name.trim()) return;
          setValues((v) => ({ ...v, name: result.name }));
          setNameWasFilled(true);
        })
        .catch(() => {
          // Best-effort convenience only; a failed lookup just means no
          // pre-fill, never an error the customer needs to see.
        });
    }, 500);

    return () => clearTimeout(timeout);
    // Deliberately excludes values.name: this should only re-run when the
    // phone changes, not on every keystroke in the name field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullPhone, business.slug]);

  async function bookAppointment() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createAppointment({
        businessSlug: business.slug,
        employeeId: employee.id,
        serviceId: service.id,
        startTime: slot.start_time,
        customer: {
          name: values.name.trim(),
          phone: fullPhone,
        },
      });
      setAppointment(created);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        router.push(
          stepUrl(business.slug, {
            service: service.id,
            employee: employee.id,
            date,
            notice: "slot-taken",
          }),
        );
        return;
      }
      setSubmitError(bookingErrorMessage(error, t));
    } finally {
      setSubmitting(false);
    }
  }

  // Verifying the phone finishes the booking automatically — the customer
  // shouldn't have to click "Confirmar reserva" a second time.
  function handleVerified() {
    setPhoneVerified(true);
    bookAppointment();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateContactForm(values, tv);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (!phoneVerified) {
      phoneVerificationRef.current?.open();
      return;
    }

    await bookAppointment();
  }

  if (appointment) {
    return (
      <div className="space-y-1 text-center text-sm">
        <p className="font-medium">
          {t("bookedTitle", { name: values.name })}
        </p>
        <p className="text-muted-foreground">
          {t("serviceWithEmployee", {
            service: service.name,
            employee: employee.name,
          })}
        </p>
        <p className="text-muted-foreground">
          {formatTime(appointment.start_time, business.timezone, locale)} (
          {formatDuration(service.duration_minutes)})
        </p>
        <p className="text-muted-foreground text-xs">
          {t("confirmationNumber", { id: appointment.id })}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <FormField
        id="contact-phone"
        label={t("phone")}
        type="tel"
        value={values.phone}
        onChange={updatePhone}
        error={errors.phone}
      />
      {phoneVerified && (
        <Badge variant="success" className="self-start">
          <CheckCircle2 />
          {tp("verified")}
        </Badge>
      )}
      <PhoneVerification
        key={fullPhone}
        ref={phoneVerificationRef}
        businessSlug={business.slug}
        phone={fullPhone}
        displayPhone={values.phone.trim()}
        onVerified={handleVerified}
      />
      <FormField
        id="contact-name"
        label={t("name")}
        value={values.name}
        onChange={(value) => updateField("name", value)}
        error={errors.name}
      />
      {nameWasFilled && (
        <p className="text-muted-foreground text-xs">{tf("note")}</p>
      )}
      {submitError && (
        <div className="border-destructive/30 bg-destructive/5 flex flex-col items-start gap-3 rounded-xl border p-3">
          <div className="text-destructive flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>{submitError.text}</p>
          </div>
          {submitError.showContact && whatsAppLink && (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a href={whatsAppLink} target="_blank" rel="noopener noreferrer" />
              }
            >
              <MessageCircle className="text-green-600 dark:text-green-500" />
              {t("contactWhatsApp", { phone: business.phone ?? "" })}
            </Button>
          )}
        </div>
      )}
      <Button type="submit" disabled={submitting}>
        {submitting && <Spinner />}
        {submitting ? t("submitting") : t("confirmBooking")}
      </Button>
    </form>
  );
}
