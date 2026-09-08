"use client";

import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import {
  createEmployee,
  deactivateEmployee,
  type Employee,
  listEmployees,
  updateEmployee,
} from "@/lib/api/employees";
import { createUser, listUsers, type User } from "@/lib/api/users";
import { type Session, useSession } from "../session-context";
import {
  type InviteFormErrors,
  type InviteFormValues,
  validateInviteForm,
} from "./invite-form-validation";

export default function EmployeesPage() {
  const session = useSession();
  const tc = useTranslations("Common");

  if (session.role !== "admin") {
    return <p className="text-muted-foreground text-sm">{tc("noAccess")}</p>;
  }

  return <EmployeeManagement session={session} />;
}

function EmployeeManagement({ session }: { session: Session }) {
  const t = useTranslations("Employees");
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(() => {
    Promise.all([listEmployees(), listUsers()])
      .then(([loadedEmployees, loadedUsers]) => {
        setEmployees(loadedEmployees);
        setUsers(loadedUsers);
      })
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

  if (!employees || !users) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <SelfEmployeeButton
        session={session}
        employees={employees}
        onAdded={reload}
      />
      <InviteEmployeeForm onInvited={reload} />
      <EmployeeList employees={employees} users={users} onChanged={reload} />
    </div>
  );
}

/**
 * Lets an admin who also takes appointments themselves (e.g. a solo
 * owner-barber) link their own user account as an Employee. Hidden once
 * that link already exists, since the backend rejects a second one.
 */
function SelfEmployeeButton({
  session,
  employees,
  onAdded,
}: {
  session: Session;
  employees: Employee[];
  onAdded: () => void;
}) {
  const t = useTranslations("Employees");
  const tc = useTranslations("Common");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (employees.some((employee) => employee.user_id === session.userId)) {
    return null;
  }

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      await createEmployee({ userId: session.userId });
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tc("genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        disabled={busy}
        className="self-start"
      >
        {busy && <Spinner />}
        {busy ? tc("adding") : t("addYourself")}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

function InviteEmployeeForm({ onInvited }: { onInvited: () => void }) {
  const t = useTranslations("Employees");
  const tc = useTranslations("Common");
  const tv = useTranslations("Validation");
  const locale = useLocale();
  const [values, setValues] = useState<InviteFormValues>({
    name: "",
    email: "",
  });
  const [errors, setErrors] = useState<InviteFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [claimLink, setClaimLink] = useState<string | null>(null);

  function updateField(field: keyof InviteFormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateInviteForm(values, tv);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    setClaimLink(null);

    const name = values.name.trim();
    const email = values.email.trim();

    let user;
    try {
      user = await createUser({ name, email, role: "employee" });
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : t("createUserError"),
      );
      setSubmitting(false);
      return;
    }

    try {
      await createEmployee({ userId: user.id });
    } catch (err) {
      setSubmitError(
        t("addAsEmployeeError", {
          email,
          reason:
            err instanceof ApiError
              ? err.message
              : t("unexpectedErrorOccurred"),
        }),
      );
      setSubmitting(false);
      return;
    }

    setClaimLink(
      `${window.location.origin}/${locale}/admin/reset-password?token=${user.claim_token}`,
    );
    setValues({ name: "", email: "" });
    setSubmitting(false);
    onInvited();
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{t("inviteTitle")}</h2>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-3"
        >
          <FormField
            id="invite-name"
            label={tc("name")}
            value={values.name}
            onChange={(v) => updateField("name", v)}
            error={errors.name}
          />
          <FormField
            id="invite-email"
            label={tc("email")}
            type="email"
            value={values.email}
            onChange={(v) => updateField("email", v)}
            error={errors.email}
          />
          {submitError && (
            <p className="text-destructive text-sm">{submitError}</p>
          )}
          <Button type="submit" disabled={submitting} className="self-start">
            {submitting && <Spinner />}
            {submitting ? t("inviting") : t("invite")}
          </Button>
        </form>
        {claimLink && (
          <div className="bg-muted/30 rounded-lg border p-3 text-sm">
            <p className="font-medium">{t("invitedShareLink")}</p>
            <p className="text-muted-foreground mt-1 font-mono text-xs break-all">
              {claimLink}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmployeeList({
  employees,
  users,
  onChanged,
}: {
  employees: Employee[];
  users: User[];
  onChanged: () => void;
}) {
  const t = useTranslations("Employees");
  if (employees.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t("noEmployeesYet")}</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {employees.map((employee) => (
        <EmployeeRow
          key={employee.id}
          employee={employee}
          email={users.find((u) => u.id === employee.user_id)?.email}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

function EmployeeRow({
  employee,
  email,
  onChanged,
}: {
  employee: Employee;
  email: string | undefined;
  onChanged: () => void;
}) {
  const tc = useTranslations("Common");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(employee.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === employee.name) {
      setEditing(false);
      setName(employee.name);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateEmployee(employee.id, { name: trimmed });
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
      if (employee.status === "active") {
        await deactivateEmployee(employee.id);
      } else {
        await updateEmployee(employee.id, { status: "active" });
      }
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tc("genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function togglePermission(permission: string, granted: boolean) {
    const permissions = granted
      ? [...employee.permissions, permission]
      : employee.permissions.filter((p) => p !== permission);
    setBusy(true);
    setError(null);
    try {
      await updateEmployee(employee.id, { permissions });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tc("genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-7"
              />
              <Button size="sm" onClick={saveName} disabled={busy}>
                {tc("save")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setName(employee.name);
                }}
                disabled={busy}
              >
                {tc("cancel")}
              </Button>
            </div>
          ) : (
            <>
              <p className="font-medium break-words">{employee.name}</p>
              {email && (
                <p className="text-muted-foreground text-xs break-words">
                  {email}
                </p>
              )}
            </>
          )}
          {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge
            variant={employee.status === "active" ? "secondary" : "outline"}
          >
            {employee.status === "active" ? tc("active") : tc("inactive")}
          </Badge>
          {!editing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              disabled={busy}
            >
              {tc("edit")}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleStatus}
            disabled={busy}
          >
            {employee.status === "active"
              ? tc("deactivate")
              : tc("reactivate")}
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2">
        <PermissionToggles
          employee={employee}
          onToggle={togglePermission}
          disabled={busy}
        />
      </CardFooter>
    </Card>
  );
}

const TOGGLEABLE_PERMISSIONS = [
  { value: "view_customers", labelKey: "canViewCustomers" },
  { value: "ban_customers", labelKey: "canBanCustomers" },
  { value: "edit_appointment_status", labelKey: "canEditAppointmentStatus" },
  {
    value: "manage_price_visibility",
    labelKey: "canManagePriceVisibility",
  },
] as const;

/** Lets an admin grant/revoke one employee's individual permissions in place. */
function PermissionToggles({
  employee,
  onToggle,
  disabled,
}: {
  employee: Employee;
  onToggle: (permission: string, granted: boolean) => void;
  disabled: boolean;
}) {
  const t = useTranslations("Employees");

  return (
    <div className="flex w-full flex-col gap-1.5">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {t("permissions")}
      </span>
      <div className="flex flex-col gap-1">
        {TOGGLEABLE_PERMISSIONS.map(({ value, labelKey }) => (
          <label
            key={value}
            className="flex w-fit items-center gap-2 text-sm select-none"
          >
            <input
              type="checkbox"
              checked={employee.permissions.includes(value)}
              onChange={(event) => onToggle(value, event.target.checked)}
              disabled={disabled}
              className="accent-primary size-3.5 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {t(labelKey)}
          </label>
        ))}
      </div>
    </div>
  );
}
