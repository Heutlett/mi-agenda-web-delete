"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import {
  createService,
  deactivateService,
  type Service,
  listServices,
  updateService,
} from "@/lib/api/services";
import { DEFAULT_CURRENCY_SYMBOL, formatPrice } from "@/lib/format";
import { useBusinessSettings } from "../business-context";
import { useSession } from "../session-context";
import {
  buildCreateServiceParams,
  buildServicePatch,
  durationHint,
  EMPTY_SERVICE_FORM,
  type ServiceFormErrors,
  type ServiceFormValues,
  serviceToFormValues,
  validateServiceForm,
} from "./service-form";

export default function ServicesPage() {
  const { role } = useSession();
  const tc = useTranslations("Common");

  if (role !== "admin") {
    return <p className="text-muted-foreground text-sm">{tc("noAccess")}</p>;
  }

  return <ServiceManagement />;
}

function ServiceManagement() {
  const t = useTranslations("Services");
  const [services, setServices] = useState<Service[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(() => {
    listServices()
      .then(setServices)
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : t("loadError"));
      });
  }, [t]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loadError) {
    return <p className="text-destructive text-sm">{loadError}</p>;
  }

  if (!services) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <CreateServiceForm onCreated={reload} />
      <ServiceList services={services} onChanged={reload} />
    </div>
  );
}

function CreateServiceForm({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations("Services");
  const tc = useTranslations("Common");
  const tf = useTranslations("ServiceForm");
  const [values, setValues] = useState<ServiceFormValues>(EMPTY_SERVICE_FORM);
  const [errors, setErrors] = useState<ServiceFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function updateField(field: keyof ServiceFormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateServiceForm(values, tf);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await createService(buildCreateServiceParams(values));
      setValues(EMPTY_SERVICE_FORM);
      onCreated();
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : t("createError"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{t("addTitle")}</h2>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-3"
        >
          <FormField
            id="service-name"
            label={tc("name")}
            value={values.name}
            onChange={(v) => updateField("name", v)}
            error={errors.name}
          />
          <FormField
            id="service-description"
            label={tc("description")}
            optional
            optionalLabel={tc("optional")}
            value={values.description}
            onChange={(v) => updateField("description", v)}
            error={errors.description}
          />
          <FormField
            id="service-duration"
            label={t("durationMinutes")}
            type="number"
            value={values.durationMinutes}
            onChange={(v) => updateField("durationMinutes", v)}
            error={errors.durationMinutes}
            hint={durationHint(tf)}
          />
          <FormField
            id="service-price"
            label={t("price")}
            value={values.price}
            onChange={(v) => updateField("price", v)}
            error={errors.price}
          />
          {submitError && (
            <p className="text-destructive text-sm">{submitError}</p>
          )}
          <Button type="submit" disabled={submitting} className="self-start">
            {submitting && <Spinner />}
            {submitting ? tc("adding") : t("addService")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ServiceList({
  services,
  onChanged,
}: {
  services: Service[];
  onChanged: () => void;
}) {
  const t = useTranslations("Services");
  if (services.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t("noServicesYet")}</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {services.map((service) => (
        <ServiceRow key={service.id} service={service} onChanged={onChanged} />
      ))}
    </div>
  );
}

function ServiceRow({
  service,
  onChanged,
}: {
  service: Service;
  onChanged: () => void;
}) {
  const t = useTranslations("Services");
  const tc = useTranslations("Common");
  const tf = useTranslations("ServiceForm");
  const { business } = useBusinessSettings();
  const currencySymbol = business?.currency_symbol ?? DEFAULT_CURRENCY_SYMBOL;
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<ServiceFormValues>(
    serviceToFormValues(service),
  );
  const [errors, setErrors] = useState<ServiceFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(field: keyof ServiceFormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function startEditing() {
    setValues(serviceToFormValues(service));
    setErrors({});
    setError(null);
    setEditing(true);
  }

  async function save() {
    const nextErrors = validateServiceForm(values, tf);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const patch = buildServicePatch(values, service);
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updateService(service.id, patch);
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tc("genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus() {
    setBusy(true);
    setError(null);
    try {
      if (service.status === "active") {
        await deactivateService(service.id);
      } else {
        await updateService(service.id, { status: "active" });
      }
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tc("genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        {editing ? (
          <div className="flex flex-col gap-3">
            <FormField
              id={`service-${service.id}-name`}
              label={tc("name")}
              value={values.name}
              onChange={(v) => updateField("name", v)}
              error={errors.name}
            />
            <FormField
              id={`service-${service.id}-description`}
              label={tc("description")}
              optional
              optionalLabel={tc("optional")}
              value={values.description}
              onChange={(v) => updateField("description", v)}
              error={errors.description}
            />
            <FormField
              id={`service-${service.id}-duration`}
              label={t("durationMinutes")}
              type="number"
              value={values.durationMinutes}
              onChange={(v) => updateField("durationMinutes", v)}
              error={errors.durationMinutes}
              hint={durationHint(tf)}
            />
            <FormField
              id={`service-${service.id}-price`}
              label={t("price")}
              value={values.price}
              onChange={(v) => updateField("price", v)}
              error={errors.price}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={save} disabled={busy}>
                {tc("save")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={busy}
              >
                {tc("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium break-words">{service.name}</p>
              {service.description && (
                <p className="text-muted-foreground text-xs break-words">
                  {service.description}
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                {service.duration_minutes} {t("minutesAbbrev")} ·{" "}
                {formatPrice(service.price, currencySymbol)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge
                variant={service.status === "active" ? "secondary" : "outline"}
              >
                {service.status === "active" ? tc("active") : tc("inactive")}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={startEditing}
                disabled={busy}
              >
                {tc("edit")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleStatus}
                disabled={busy}
              >
                {service.status === "active"
                  ? tc("deactivate")
                  : tc("reactivate")}
              </Button>
            </div>
          </div>
        )}
        {error && <p className="text-destructive text-xs">{error}</p>}
      </CardContent>
    </Card>
  );
}
