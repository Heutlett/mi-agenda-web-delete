"use client";

import { AlertTriangle, MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { FormField } from "@/components/form-field";
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
import { toIntlLocale } from "@/lib/date";
import { formatDuration, formatTime } from "@/lib/format";
import { digitsOnly, normalizePhone } from "./contact-form-phone";
import {
  type ContactFormErrors,
  type ContactFormValues,
  validateContactForm,
} from "./contact-form-validation";
import { stepUrl } from "./step-url";

/**
 * A wa.me link to the business's own WhatsApp number, so a customer who
 * hits a booking error (limit reached, banned) has an immediate way to
 * reach out instead of a dead-end message — the most common client is on
 * their phone already, so this opens straight into a WhatsApp chat rather
 * than just displaying a number to dial. A business's phone is required,
 * but not format-checked (see mi-agenda-api's POST /businesses), so this
 * still guards against garbage data rather than assuming it's usable.
 */
function businessWhatsAppLink(phone: string): string | null {
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
    case "invalid phone number":
      return { text: t("invalidPhone"), showContact: false };
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

  function updateField(field: keyof ContactFormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateContactForm(values, tv);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

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
        onChange={(value) => updateField("phone", value)}
        error={errors.phone}
      />
      <FormField
        id="contact-name"
        label={t("name")}
        value={values.name}
        onChange={(value) => updateField("name", value)}
        error={errors.name}
      />
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
              {t("contactWhatsApp", { phone: business.phone })}
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
