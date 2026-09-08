"use client";

import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  type AvailabilityBlock,
  createAvailabilityBlock,
  deleteAvailabilityBlock,
  listAvailabilityBlocks,
} from "@/lib/api/availability-blocks";
import { ApiError } from "@/lib/api/client";
import { type Employee, listEmployees } from "@/lib/api/employees";
import { formatDateTime, toIntlLocale } from "@/lib/date";
import { useSession } from "../session-context";
import {
  type AvailabilityFormErrors,
  type AvailabilityFormValues,
  buildCreateAvailabilityBlockParams,
  EMPTY_AVAILABILITY_FORM,
  validateAvailabilityForm,
} from "./availability-form";

export default function AvailabilityPage() {
  const { role } = useSession();
  const tc = useTranslations("Common");

  if (role !== "admin") {
    return <p className="text-muted-foreground text-sm">{tc("noAccess")}</p>;
  }

  return <AvailabilityManagement />;
}

function AvailabilityManagement() {
  const t = useTranslations("Availability");
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    listEmployees()
      .then((loaded) => {
        setEmployees(loaded);
        if (loaded.length > 0) setSelectedEmployeeId(loaded[0].id);
      })
      .catch((err: unknown) => {
        setLoadError(
          err instanceof ApiError ? err.message : t("loadErrorEmployees"),
        );
      });
  }, [t]);

  if (loadError) {
    return <p className="text-destructive text-sm">{loadError}</p>;
  }

  if (!employees) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("addEmployeeFirst")}
      </p>
    );
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <div className="flex flex-col gap-1">
        <label htmlFor="availability-employee" className="text-sm font-medium">
          {t("employee")}
        </label>
        <Select
          id="availability-employee"
          value={selectedEmployeeId ?? ""}
          onChange={(event) => setSelectedEmployeeId(event.target.value)}
        >
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </Select>
      </div>
      {selectedEmployeeId && (
        <EmployeeAvailability
          key={selectedEmployeeId}
          employeeId={selectedEmployeeId}
        />
      )}
    </div>
  );
}

function EmployeeAvailability({ employeeId }: { employeeId: string }) {
  const t = useTranslations("Availability");
  const [blocks, setBlocks] = useState<AvailabilityBlock[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(() => {
    listAvailabilityBlocks(employeeId)
      .then(setBlocks)
      .catch((err: unknown) => {
        setLoadError(
          err instanceof ApiError ? err.message : t("loadErrorBlocks"),
        );
      });
  }, [employeeId, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loadError) {
    return <p className="text-destructive text-sm">{loadError}</p>;
  }

  if (!blocks) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <>
      <CreateAvailabilityBlockForm employeeId={employeeId} onCreated={reload} />
      <AvailabilityBlockList blocks={blocks} onChanged={reload} />
    </>
  );
}

function CreateAvailabilityBlockForm({
  employeeId,
  onCreated,
}: {
  employeeId: string;
  onCreated: () => void;
}) {
  const t = useTranslations("Availability");
  const tc = useTranslations("Common");
  const tf = useTranslations("AvailabilityForm");
  const [values, setValues] = useState<AvailabilityFormValues>(
    EMPTY_AVAILABILITY_FORM,
  );
  const [errors, setErrors] = useState<AvailabilityFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function updateField(field: keyof AvailabilityFormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateAvailabilityForm(values, tf);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await createAvailabilityBlock(
        buildCreateAvailabilityBlockParams(employeeId, values),
      );
      setValues(EMPTY_AVAILABILITY_FORM);
      onCreated();
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : t("addBlockError"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{t("addTitle")}</h2>
        <p className="text-muted-foreground text-xs">{t("localTimeHint")}</p>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-3"
        >
          <FormField
            id="availability-start"
            label={t("start")}
            type="datetime-local"
            value={values.startTime}
            onChange={(v) => updateField("startTime", v)}
            error={errors.startTime}
          />
          <FormField
            id="availability-end"
            label={t("end")}
            type="datetime-local"
            value={values.endTime}
            onChange={(v) => updateField("endTime", v)}
            error={errors.endTime}
          />
          <FormField
            id="availability-reason"
            label={t("reason")}
            optional
            optionalLabel={tc("optional")}
            value={values.reason}
            onChange={(v) => updateField("reason", v)}
            error={errors.reason}
          />
          {submitError && (
            <p className="text-destructive text-sm">{submitError}</p>
          )}
          <Button type="submit" disabled={submitting} className="self-start">
            {submitting && <Spinner />}
            {submitting ? tc("adding") : t("addBlock")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AvailabilityBlockList({
  blocks,
  onChanged,
}: {
  blocks: AvailabilityBlock[];
  onChanged: () => void;
}) {
  const t = useTranslations("Availability");
  if (blocks.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("noTimeOff")}</p>;
  }

  const sorted = [...blocks].sort((a, b) =>
    a.start_time.localeCompare(b.start_time),
  );

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((block) => (
        <AvailabilityBlockRow
          key={block.id}
          block={block}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

function AvailabilityBlockRow({
  block,
  onChanged,
}: {
  block: AvailabilityBlock;
  onChanged: () => void;
}) {
  const t = useTranslations("Availability");
  const tc = useTranslations("Common");
  const locale = toIntlLocale(useLocale());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(t("confirmDelete"))) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await deleteAvailabilityBlock(block.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tc("genericError"));
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            {formatDateTime(block.start_time, locale)} –{" "}
            {formatDateTime(block.end_time, locale)}
          </p>
          {block.reason && (
            <p className="text-muted-foreground text-xs break-words">
              {block.reason}
            </p>
          )}
          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={busy}
        >
          {tc("delete")}
        </Button>
      </CardContent>
    </Card>
  );
}
