"use client";

import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import { type Employee, listEmployees } from "@/lib/api/employees";
import {
  createSchedule,
  deactivateSchedule,
  type Schedule,
  listSchedules,
  updateSchedule,
} from "@/lib/api/schedules";
import { useSession } from "../session-context";
import {
  buildCreateScheduleParams,
  buildSchedulePatch,
  dayNames,
  EMPTY_SCHEDULE_FORM,
  type ScheduleFormErrors,
  type ScheduleFormValues,
  scheduleToFormValues,
  validateScheduleForm,
} from "./schedule-form";

export default function SchedulesPage() {
  const { role } = useSession();
  const tc = useTranslations("Common");

  if (role !== "admin") {
    return <p className="text-muted-foreground text-sm">{tc("noAccess")}</p>;
  }

  return <ScheduleManagement />;
}

function ScheduleManagement() {
  const t = useTranslations("Schedules");
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
        <label htmlFor="schedule-employee" className="text-sm font-medium">
          {t("employee")}
        </label>
        <Select
          id="schedule-employee"
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
        <EmployeeSchedule
          key={selectedEmployeeId}
          employeeId={selectedEmployeeId}
        />
      )}
    </div>
  );
}

function EmployeeSchedule({ employeeId }: { employeeId: string }) {
  const t = useTranslations("Schedules");
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(() => {
    listSchedules(employeeId)
      .then(setSchedules)
      .catch((err: unknown) => {
        setLoadError(
          err instanceof ApiError ? err.message : t("loadErrorSchedules"),
        );
      });
  }, [employeeId, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loadError) {
    return <p className="text-destructive text-sm">{loadError}</p>;
  }

  if (!schedules) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <>
      <CreateScheduleForm employeeId={employeeId} onCreated={reload} />
      <ScheduleWeek schedules={schedules} onChanged={reload} />
    </>
  );
}

function CreateScheduleForm({
  employeeId,
  onCreated,
}: {
  employeeId: string;
  onCreated: () => void;
}) {
  const t = useTranslations("Schedules");
  const tc = useTranslations("Common");
  const tf = useTranslations("ScheduleForm");
  const locale = useLocale();
  const days = dayNames(locale);
  const [values, setValues] = useState<ScheduleFormValues>(EMPTY_SCHEDULE_FORM);
  const [errors, setErrors] = useState<ScheduleFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function updateField(field: keyof ScheduleFormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateScheduleForm(values, tf);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await createSchedule(buildCreateScheduleParams(employeeId, values));
      setValues({ ...EMPTY_SCHEDULE_FORM, dayOfWeek: values.dayOfWeek });
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
        <h2 className="text-sm font-medium">{t("addBlockTitle")}</h2>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="schedule-day" className="text-sm font-medium">
              {t("day")}
            </label>
            <Select
              id="schedule-day"
              value={values.dayOfWeek}
              onChange={(event) => updateField("dayOfWeek", event.target.value)}
            >
              {days.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          <FormField
            id="schedule-start"
            label={t("startTime")}
            type="time"
            value={values.startTime}
            onChange={(v) => updateField("startTime", v)}
            error={errors.startTime}
          />
          <FormField
            id="schedule-end"
            label={t("endTime")}
            type="time"
            value={values.endTime}
            onChange={(v) => updateField("endTime", v)}
            error={errors.endTime}
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

function ScheduleWeek({
  schedules,
  onChanged,
}: {
  schedules: Schedule[];
  onChanged: () => void;
}) {
  const t = useTranslations("Schedules");
  const locale = useLocale();
  const days = dayNames(locale);
  return (
    <div className="flex flex-col gap-4">
      {days.map((name, dayOfWeek) => {
        const dayBlocks = schedules
          .filter((s) => s.day_of_week === dayOfWeek)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));

        return (
          <div key={name} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{name}</h3>
            {dayBlocks.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                {t("noHoursSet")}
              </p>
            ) : (
              dayBlocks.map((schedule) => (
                <ScheduleRow
                  key={schedule.id}
                  schedule={schedule}
                  onChanged={onChanged}
                />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScheduleRow({
  schedule,
  onChanged,
}: {
  schedule: Schedule;
  onChanged: () => void;
}) {
  const t = useTranslations("Schedules");
  const tc = useTranslations("Common");
  const tf = useTranslations("ScheduleForm");
  const locale = useLocale();
  const days = dayNames(locale);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<ScheduleFormValues>(
    scheduleToFormValues(schedule),
  );
  const [errors, setErrors] = useState<ScheduleFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(field: keyof ScheduleFormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function startEditing() {
    setValues(scheduleToFormValues(schedule));
    setErrors({});
    setError(null);
    setEditing(true);
  }

  async function save() {
    const nextErrors = validateScheduleForm(values, tf);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const patch = buildSchedulePatch(values, schedule);
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updateSchedule(schedule.id, patch);
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
      if (schedule.status === "active") {
        await deactivateSchedule(schedule.id);
      } else {
        await updateSchedule(schedule.id, { status: "active" });
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
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`schedule-${schedule.id}-day`}
                className="text-sm font-medium"
              >
                {t("day")}
              </label>
              <Select
                id={`schedule-${schedule.id}-day`}
                value={values.dayOfWeek}
                onChange={(event) =>
                  updateField("dayOfWeek", event.target.value)
                }
              >
                {days.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
            <FormField
              id={`schedule-${schedule.id}-start`}
              label={t("startTime")}
              type="time"
              value={values.startTime}
              onChange={(v) => updateField("startTime", v)}
              error={errors.startTime}
            />
            <FormField
              id={`schedule-${schedule.id}-end`}
              label={t("endTime")}
              type="time"
              value={values.endTime}
              onChange={(v) => updateField("endTime", v)}
              error={errors.endTime}
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
            <p className="text-sm">
              {schedule.start_time} – {schedule.end_time}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Badge
                variant={schedule.status === "active" ? "secondary" : "outline"}
              >
                {schedule.status === "active" ? tc("active") : tc("inactive")}
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
                {schedule.status === "active"
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
