"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { getMyBusiness, type Business, updateBusiness } from "@/lib/api/business";
import { ApiError } from "@/lib/api/client";
import { useBusinessSettings } from "../business-context";
import { useSession } from "../session-context";
import {
  type BusinessFormErrors,
  type BusinessFormValues,
  buildBusinessPatch,
  businessToFormValues,
  validateBusinessForm,
} from "./business-form";
import { timezoneOptions, withCurrentTimezone } from "./timezones";

// Each language's own native name, the same way LanguageSwitcher labels
// them — not translated via t(), since a language's name in a picker is
// conventionally shown in that language itself, not the currently active one.
const LANGUAGE_OPTIONS = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

export default function BusinessPage() {
  const { role } = useSession();

  return role === "admin" ? <BusinessSettingsForm /> : <BusinessReadOnlyView />;
}

/**
 * An employee can see which business they work for (and its contact
 * info), but only an admin can change it — see business.go's
 * PATCH /businesses/{id}, still admin-only server-side. Settings an
 * employee can be individually granted, like manage_price_visibility, live
 * on the Profile page instead — not here, since a permission granted to
 * one employee shouldn't require giving them access to a page that
 * configures the rest of the business for everyone else.
 */
function BusinessReadOnlyView() {
  const t = useTranslations("Business");
  const tc = useTranslations("Common");
  const [business, setBusiness] = useState<Business | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyBusiness()
      .then((loaded) => {
        if (!cancelled) setBusiness(loaded);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : t("loadError"));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loadError) {
    return <p className="text-destructive text-sm">{loadError}</p>;
  }

  if (!business) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <div className="flex max-w-md flex-col gap-2 text-sm">
      <h1 className="text-lg font-semibold">{business.name}</h1>
      <p>
        <span className="text-muted-foreground">{tc("phone")}: </span>
        {business.phone}
      </p>
      {business.email && (
        <p>
          <span className="text-muted-foreground">{tc("email")}: </span>
          {business.email}
        </p>
      )}
      {business.address && (
        <p>
          <span className="text-muted-foreground">{tc("address")}: </span>
          {business.address}
        </p>
      )}
    </div>
  );
}

function BusinessSettingsForm() {
  const t = useTranslations("Business");
  const tc = useTranslations("Common");
  const tf = useTranslations("BusinessForm");
  const tz = useTranslations("Timezones");
  const { setBusiness: setSharedBusiness } = useBusinessSettings();
  const [business, setBusiness] = useState<Business | null>(null);
  const [values, setValues] = useState<BusinessFormValues | null>(null);
  const [errors, setErrors] = useState<BusinessFormErrors>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyBusiness()
      .then((loaded) => {
        if (cancelled) return;
        setBusiness(loaded);
        setValues(businessToFormValues(loaded));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : t("loadError"));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  function updateField(field: keyof BusinessFormValues, value: string) {
    setValues((v) => (v ? { ...v, [field]: value } : v));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setSaved(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values || !business) return;

    const nextErrors = validateBusinessForm(values, tf);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const patch = buildBusinessPatch(values, business);
    if (Object.keys(patch).length === 0) {
      // Nothing real to send — most likely the only "change" was blanking an
      // optional field the API has no way to actually clear (see
      // buildBusinessPatch's comment). Re-sync from the last known-good
      // business instead of silently leaving the form showing a value that
      // was never saved.
      setValues(businessToFormValues(business));
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const updated = await updateBusiness(business.id, patch);
      setBusiness(updated);
      setSharedBusiness(updated);
      setValues(businessToFormValues(updated));
      setSaved(true);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : tc("genericErrorRetry"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return <p className="text-destructive text-sm">{loadError}</p>;
  }

  if (!values) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  const timezoneChoices = withCurrentTimezone(
    values.timezone,
    timezoneOptions(tz),
  );

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex max-w-md flex-col gap-3"
    >
      <h1 className="text-lg font-semibold">{t("title")}</h1>

      <FormField
        id="business-name"
        label={tc("name")}
        value={values.name}
        onChange={(v) => updateField("name", v)}
        error={errors.name}
      />
      <FormField
        id="business-slug"
        label={tc("slug")}
        value={values.slug}
        onChange={(v) => updateField("slug", v)}
        error={errors.slug}
      />
      <FormField
        id="business-phone"
        label={tc("phone")}
        value={values.phone}
        onChange={(v) => updateField("phone", v)}
        error={errors.phone}
      />
      <FormField
        id="business-email"
        label={tc("email")}
        optional
        optionalLabel={tc("optional")}
        type="email"
        value={values.email}
        onChange={(v) => updateField("email", v)}
        error={errors.email}
      />
      <FormField
        id="business-address"
        label={tc("address")}
        optional
        optionalLabel={tc("optional")}
        value={values.address}
        onChange={(v) => updateField("address", v)}
        error={errors.address}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="business-timezone" className="text-sm font-medium">
          {t("timezone")}
        </label>
        <Select
          id="business-timezone"
          value={values.timezone}
          onChange={(event) => updateField("timezone", event.target.value)}
          aria-invalid={!!errors.timezone}
        >
          {timezoneChoices.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        {errors.timezone && (
          <p className="text-destructive text-xs">{errors.timezone}</p>
        )}
      </div>

      <FormField
        id="business-max-appointments-per-day"
        label={t("maxAppointmentsPerCustomerPerDay")}
        type="number"
        value={values.maxAppointmentsPerCustomerPerDay}
        onChange={(v) => updateField("maxAppointmentsPerCustomerPerDay", v)}
        error={errors.maxAppointmentsPerCustomerPerDay}
      />
      <FormField
        id="business-max-appointments-per-week"
        label={t("maxAppointmentsPerCustomerPerWeek")}
        type="number"
        value={values.maxAppointmentsPerCustomerPerWeek}
        onChange={(v) => updateField("maxAppointmentsPerCustomerPerWeek", v)}
        error={errors.maxAppointmentsPerCustomerPerWeek}
      />
      <FormField
        id="business-currency-symbol"
        label={t("currencySymbol")}
        value={values.currencySymbol}
        onChange={(v) => updateField("currencySymbol", v)}
        error={errors.currencySymbol}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="business-language" className="text-sm font-medium">
          {t("language")}
        </label>
        <p className="text-muted-foreground text-xs">{t("languageHint")}</p>
        <Select
          id="business-language"
          value={values.language}
          onChange={(event) => updateField("language", event.target.value)}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{tc("status")}</span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={values.status === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => updateField("status", "active")}
          >
            {tc("active")}
          </Button>
          <Button
            type="button"
            variant={values.status === "inactive" ? "default" : "outline"}
            size="sm"
            onClick={() => updateField("status", "inactive")}
          >
            {tc("inactive")}
          </Button>
        </div>
        {values.status === "inactive" && (
          <p className="text-muted-foreground text-xs">{t("inactiveHint")}</p>
        )}
      </div>

      {submitError && <p className="text-destructive text-sm">{submitError}</p>}
      {saved && (
        <p className="text-sm text-green-600 dark:text-green-500">
          {tc("saved")}
        </p>
      )}

      <Button type="submit" disabled={submitting} className="self-start">
        {submitting && <Spinner />}
        {submitting ? tc("saving") : tc("saveChanges")}
      </Button>
    </form>
  );
}
