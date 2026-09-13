"use client";

import { AlertTriangle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import { type Employee, getCurrentEmployee, listEmployees } from "@/lib/api/employees";
import {
  createSchedule,
  deleteSchedule,
  type Schedule,
  listSchedules,
  updateSchedule,
} from "@/lib/api/schedules";
import { hasPermission, useSession } from "../session-context";
import {
  buildCreateScheduleParams,
  buildSchedulePatch,
  dayNames,
  EMPTY_SCHEDULE_FORM,
  type ScheduleFormErrors,
  type ScheduleFormValues,
  scheduleToFormValues,
  translateScheduleApiError,
  validateScheduleForm,
} from "./schedule-form";

/**
 * Renders a schedule form's submit error: a known cross-schedule
 * business-rule rejection (overlap, a second lunch break) gets the amber
 * warning-chip treatment, since it's an expected, actionable rule rather
 * than a failure; anything else keeps the plain destructive-red text.
 */
function ScheduleSubmitError({
  message,
  t,
}: {
  message: string;
  t: (key: string) => string;
}) {
  const { text, isBusinessRuleError } = translateScheduleApiError(message, t);

  if (!isBusinessRuleError) {
    return <p className="text-destructive text-sm">{text}</p>;
  }

  return (
    <div className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 flex items-start gap-2 rounded-lg border p-3">
      <AlertTriangle className="text-amber-600 dark:text-amber-500 mt-0.5 size-4 shrink-0" />
      <p className="text-amber-800 dark:text-amber-200 text-sm">{text}</p>
    </div>
  );
}

export default function SchedulesPage() {
  const session = useSession();
  const tc = useTranslations("Common");

  if (!hasPermission(session, "manage_schedule")) {
    return <p className="text-muted-foreground text-sm">{tc("noAccess")}</p>;
  }

  return session.role === "admin" ? (
    <AdminScheduleManagement />
  ) : (
    <OwnScheduleManagement />
  );
}

/** An admin picks which employee's schedule to view/edit, exactly as before. */
function AdminScheduleManagement() {
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

/** A permitted employee manages only their own schedule — no picker, since there's nothing to pick between. */
function OwnScheduleManagement() {
  const t = useTranslations("Schedules");
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentEmployee()
      .then((employee) => setEmployeeId(employee.id))
      .catch((err: unknown) => {
        setLoadError(
          err instanceof ApiError ? err.message : t("loadErrorEmployees"),
        );
      });
  }, [t]);

  if (loadError) {
    return <p className="text-destructive text-sm">{loadError}</p>;
  }

  if (!employeeId) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <EmployeeSchedule employeeId={employeeId} />
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
          <FormField
            id="schedule-lunch-start"
            label={t("lunchStart")}
            type="time"
            optional
            optionalLabel={tc("optional")}
            value={values.lunchStart}
            onChange={(v) => updateField("lunchStart", v)}
            error={errors.lunchStart}
          />
          <FormField
            id="schedule-lunch-end"
            label={t("lunchEnd")}
            type="time"
            optional
            optionalLabel={tc("optional")}
            value={values.lunchEnd}
            onChange={(v) => updateField("lunchEnd", v)}
            error={errors.lunchEnd}
          />
          {submitError && <ScheduleSubmitError message={submitError} t={tf} />}
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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

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

  async function performDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteSchedule(schedule.id);
      setConfirmDeleteOpen(false);
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
            <FormField
              id={`schedule-${schedule.id}-lunch-start`}
              label={t("lunchStart")}
              type="time"
              optional
              optionalLabel={tc("optional")}
              value={values.lunchStart}
              onChange={(v) => updateField("lunchStart", v)}
              error={errors.lunchStart}
            />
            <FormField
              id={`schedule-${schedule.id}-lunch-end`}
              label={t("lunchEnd")}
              type="time"
              optional
              optionalLabel={tc("optional")}
              value={values.lunchEnd}
              onChange={(v) => updateField("lunchEnd", v)}
              error={errors.lunchEnd}
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
            <div>
              <p className="text-sm">
                {schedule.start_time} – {schedule.end_time}
              </p>
              {schedule.lunch_start && schedule.lunch_end && (
                <p className="text-muted-foreground text-xs">
                  {t("lunchLabel", {
                    start: schedule.lunch_start,
                    end: schedule.lunch_end,
                  })}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
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
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={busy}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {tc("delete")}
              </Button>
            </div>
          </div>
        )}
        {error && <ScheduleSubmitError message={error} t={tf} />}
      </CardContent>
      {confirmDeleteOpen && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setConfirmDeleteOpen(false);
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
              <DialogDescription>{t("deleteConfirmBody")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmDeleteOpen(false)}
                disabled={busy}
              >
                {tc("cancel")}
              </Button>
              <Button variant="destructive" onClick={performDelete} disabled={busy}>
                {busy && <Spinner />}
                {tc("delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
