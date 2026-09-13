"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAppointments } from "@/lib/api/appointments";
import { ApiError } from "@/lib/api/client";
import {
  createEmployee,
  deleteEmployee,
  type Employee,
  listEmployees,
  updateEmployee,
} from "@/lib/api/employees";
import { listSchedules } from "@/lib/api/schedules";
import { type Service, listServices } from "@/lib/api/services";
import { createUser, listUsers, type User } from "@/lib/api/users";
import { employeeIdsWithActiveSchedule } from "@/lib/schedule-check";
import { type Session, useSession } from "../session-context";
import {
  filterEmployees,
  type SortColumn,
  type SortState,
  sortEmployees,
} from "./employee-filter";
import {
  type InviteFormErrors,
  type InviteFormValues,
  validateInviteForm,
} from "./invite-form-validation";

function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

const TOGGLEABLE_PERMISSIONS = [
  { value: "view_customers", labelKey: "canViewCustomers", shortLabelKey: "shortViewCustomers" },
  { value: "ban_customers", labelKey: "canBanCustomers", shortLabelKey: "shortBanCustomers" },
  {
    value: "edit_appointment_status",
    labelKey: "canEditAppointmentStatus",
    shortLabelKey: "shortEditAppointmentStatus",
  },
  {
    value: "manage_price_visibility",
    labelKey: "canManagePriceVisibility",
    shortLabelKey: "shortManagePriceVisibility",
  },
  { value: "manage_schedule", labelKey: "canManageSchedule", shortLabelKey: "shortManageSchedule" },
  { value: "manage_services", labelKey: "canManageServices", shortLabelKey: "shortManageServices" },
] as const;

export default function EmployeesPage() {
  const session = useSession();
  const tc = useTranslations("Common");

  if (session.role !== "admin") {
    return <p className="text-muted-foreground text-sm">{tc("noAccess")}</p>;
  }

  return <EmployeeManagement session={session} />;
}

/** create: the Invite button opens an empty EmployeeFormDialog. edit: it opens pre-filled for that professional. delete: DeleteEmployeeDialog is showing for that professional. */
type ModalState =
  | { mode: "create" }
  | { mode: "edit"; employee: Employee }
  | { mode: "delete"; employee: Employee }
  | null;

function EmployeeManagement({ session }: { session: Session }) {
  const t = useTranslations("Employees");
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  // Loaded purely to warn before deleting someone (upcoming appointments,
  // or being the only professional left on a service) and to hint when a
  // professional has no working hours configured yet — neither blocks
  // anything, both just make sure the admin isn't acting blind.
  const [services, setServices] = useState<Service[] | null>(null);
  const [employeeIdsWithSchedule, setEmployeeIdsWithSchedule] = useState<
    ReadonlySet<string>
  >(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

  const reload = useCallback(() => {
    Promise.all([listEmployees(), listUsers()])
      .then(([loadedEmployees, loadedUsers]) => {
        setEmployees(loadedEmployees);
        setUsers(loadedUsers);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : t("loadError"));
      });
    listServices()
      .then(setServices)
      .catch(() => {
        // The "sole provider" warning just won't be available; deleting still works.
      });
    listSchedules()
      .then((schedules) => setEmployeeIdsWithSchedule(employeeIdsWithActiveSchedule(schedules)))
      .catch(() => {
        // The "no schedule yet" hint just won't show.
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <SelfEmployeeButton session={session} employees={employees} onAdded={reload} />
          <Button size="sm" onClick={() => setModal({ mode: "create" })}>
            <Plus data-icon="inline-start" />
            {t("invite")}
          </Button>
        </div>
      </div>

      <EmployeesTable
        employees={employees}
        users={users}
        services={services}
        employeeIdsWithSchedule={employeeIdsWithSchedule}
        onReload={reload}
        modal={modal}
        onModalChange={setModal}
      />
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
      <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={busy}>
        {busy && <Spinner />}
        {busy ? tc("adding") : t("addYourself")}
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

/** Toolbar (search) + sortable table + the create/edit/delete dialogs. */
function EmployeesTable({
  employees,
  users,
  services,
  employeeIdsWithSchedule,
  onReload,
  modal,
  onModalChange,
}: {
  employees: Employee[];
  users: User[];
  services: Service[] | null;
  employeeIdsWithSchedule: ReadonlySet<string>;
  onReload: () => void;
  modal: ModalState;
  onModalChange: (modal: ModalState) => void;
}) {
  const t = useTranslations("Employees");
  const tc = useTranslations("Common");

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>({ column: "name", direction: "asc" });

  const visible = useMemo(
    () => sortEmployees(filterEmployees(employees, query), sort),
    [employees, query, sort],
  );

  function toggleSort(column: SortColumn) {
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" },
    );
  }

  const soleServiceNamesFor = (employeeId: string): string[] =>
    services
      ?.filter(
        (s) =>
          s.employee_ids.includes(employeeId) &&
          s.employee_ids.filter((id) => employees.some((e) => e.id === id)).length === 1,
      )
      .map((s) => s.name) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="search"
        placeholder={t("searchPlaceholder")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="max-w-xs"
      />

      {employees.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noEmployeesYet")}</p>
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noMatch")}</p>
      ) : (
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <SortableHeader
                column="name"
                label={tc("name")}
                sort={sort}
                onSort={toggleSort}
                className="w-64"
              />
              <TableHead>{t("permissions")}</TableHead>
              <TableHead className="w-28 text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((employee) => (
              <EmployeeTableRow
                key={employee.id}
                employee={employee}
                email={users.find((u) => u.id === employee.user_id)?.email}
                hasSchedule={employeeIdsWithSchedule.has(employee.id)}
                onEdit={() => onModalChange({ mode: "edit", employee })}
                onDelete={() => onModalChange({ mode: "delete", employee })}
              />
            ))}
          </TableBody>
        </Table>
      )}

      {(modal?.mode === "create" || modal?.mode === "edit") && (
        <EmployeeFormDialog
          employee={modal.mode === "edit" ? modal.employee : null}
          onClose={() => onModalChange(null)}
          onSaved={() => {
            onModalChange(null);
            onReload();
          }}
        />
      )}

      {modal?.mode === "delete" && (
        <DeleteEmployeeDialog
          employee={modal.employee}
          soleServiceNames={soleServiceNamesFor(modal.employee.id)}
          onClose={() => onModalChange(null)}
          onDeleted={() => {
            onModalChange(null);
            onReload();
          }}
        />
      )}
    </div>
  );
}

function SortableHeader({
  column,
  label,
  sort,
  onSort,
  className,
}: {
  column: SortColumn;
  label: string;
  sort: SortState;
  onSort: (column: SortColumn) => void;
  className?: string;
}) {
  const active = sort.column === column;
  const Icon = active ? (sort.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="text-muted-foreground hover:text-foreground -m-1 flex items-center gap-1 rounded p-1 font-medium"
      >
        {label}
        <Icon className="size-3.5" />
      </button>
    </TableHead>
  );
}

function EmployeeTableRow({
  employee,
  email,
  hasSchedule,
  onEdit,
  onDelete,
}: {
  employee: Employee;
  email: string | undefined;
  hasSchedule: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("Employees");
  const tc = useTranslations("Common");

  const grantedPermissions = TOGGLEABLE_PERMISSIONS.filter((p) =>
    employee.permissions.includes(p.value),
  );

  return (
    <TableRow>
      <TableCell>
        <p className="truncate font-medium">{employee.name}</p>
        {email && <p className="text-muted-foreground truncate text-xs">{email}</p>}
        {!hasSchedule && (
          <Badge variant="warning" title={t("noScheduleHint")} className="mt-1">
            {t("noScheduleChip")}
          </Badge>
        )}
      </TableCell>
      <TableCell className="whitespace-normal">
        {grantedPermissions.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {grantedPermissions.map((p) => (
              <Badge key={p.value} variant="secondary" title={t(p.labelKey)}>
                {t(p.shortLabelKey)}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">{t("noPermissions")}</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            title={tc("edit")}
            aria-label={tc("edit")}
          >
            <Pencil />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            title={tc("delete")}
            aria-label={tc("delete")}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * Create when employee is null (invite flow: creates a User, then links it
 * as an Employee, then shows a claim link to share). Edit otherwise (name
 * and permissions only — the linked user account can't change). Only ever
 * mounted while its modal is open, so its state initializes fresh from
 * `employee` every time it's opened.
 */
function EmployeeFormDialog({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return employee ? (
    <EditEmployeeDialog employee={employee} onClose={onClose} onSaved={onSaved} />
  ) : (
    <InviteEmployeeDialog onClose={onClose} onInvited={onSaved} />
  );
}

function InviteEmployeeDialog({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: () => void;
}) {
  const t = useTranslations("Employees");
  const tc = useTranslations("Common");
  const tv = useTranslations("Validation");
  const locale = useLocale();
  const [values, setValues] = useState<InviteFormValues>({ name: "", email: "" });
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

    const name = values.name.trim();
    const email = values.email.trim();

    let user;
    try {
      user = await createUser({ name, email, role: "employee" });
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : t("createUserError"));
      setSubmitting(false);
      return;
    }

    try {
      await createEmployee({ userId: user.id });
    } catch (err) {
      setSubmitError(
        t("addAsEmployeeError", {
          email,
          reason: err instanceof ApiError ? err.message : t("unexpectedErrorOccurred"),
        }),
      );
      setSubmitting(false);
      return;
    }

    setClaimLink(`${window.location.origin}/${locale}/admin/reset-password?token=${user.claim_token}`);
    setSubmitting(false);
    onInvited();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("inviteTitle")}</DialogTitle>
        </DialogHeader>
        {claimLink ? (
          <div className="flex flex-col gap-3">
            <div className="bg-muted/30 rounded-lg border p-3 text-sm">
              <p className="font-medium">{t("invitedShareLink")}</p>
              <p className="text-muted-foreground mt-1 font-mono text-xs break-all">
                {claimLink}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" onClick={onClose}>
                {t("close")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
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
            {submitError && <p className="text-destructive text-sm">{submitError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Spinner />}
                {submitting ? t("inviting") : t("invite")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditEmployeeDialog({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("Employees");
  const tc = useTranslations("Common");
  const [name, setName] = useState(employee.name);
  const [permissions, setPermissions] = useState<string[]>(employee.permissions);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  const dirty =
    name.trim() !== employee.name ||
    JSON.stringify([...permissions].sort()) !== JSON.stringify([...employee.permissions].sort());

  function requestClose() {
    if (dirty) {
      setConfirmDiscardOpen(true);
    } else {
      onClose();
    }
  }

  function togglePermission(permission: string, checked: boolean) {
    setPermissions((current) =>
      checked ? [...current, permission] : current.filter((p) => p !== permission),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const patch: { name?: string; permissions?: string[] } = {};
      if (trimmed !== employee.name) patch.name = trimmed;
      if (JSON.stringify([...permissions].sort()) !== JSON.stringify([...employee.permissions].sort())) {
        patch.permissions = permissions;
      }
      if (Object.keys(patch).length > 0) {
        await updateEmployee(employee.id, patch);
      }
      onSaved();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : tc("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) requestClose(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
            <FormField
              id="employee-name"
              label={tc("name")}
              value={name}
              onChange={setName}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t("permissions")}</span>
              <div className="flex flex-col gap-1">
                {TOGGLEABLE_PERMISSIONS.map(({ value, labelKey }) => (
                  <label key={value} className="flex items-center gap-2 text-sm select-none">
                    <input
                      type="checkbox"
                      checked={permissions.includes(value)}
                      onChange={(event) => togglePermission(value, event.target.checked)}
                      className="accent-primary size-3.5"
                    />
                    {t(labelKey)}
                  </label>
                ))}
              </div>
            </div>
            {submitError && <p className="text-destructive text-sm">{submitError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={requestClose} disabled={submitting}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Spinner />}
                {tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("unsavedChangesTitle")}</DialogTitle>
            <DialogDescription>{t("unsavedChangesBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDiscardOpen(false)}>
              {t("unsavedChangesStay")}
            </Button>
            <Button variant="destructive" onClick={onClose}>
              {t("unsavedChangesDiscard")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeleteEmployeeDialog({
  employee,
  soleServiceNames,
  onClose,
  onDeleted,
}: {
  employee: Employee;
  /** Services this is the only remaining professional for — shown as a warning before deleting. */
  soleServiceNames: string[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("Employees");
  const tc = useTranslations("Common");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Best-effort: null while loading, after which a real (possibly zero)
  // count is shown. A failed fetch just leaves this warning out — the
  // sole-service warning above still stands on its own either way.
  const [upcomingCount, setUpcomingCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAppointments({
      employeeId: employee.id,
      status: "CONFIRMED",
      startDate: todayLocal(),
    })
      .then((result) => {
        if (!cancelled) setUpcomingCount(result.length);
      })
      .catch(() => {
        // No count shown if this fails.
      });
    return () => {
      cancelled = true;
    };
  }, [employee.id]);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteEmployee(employee.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("deleteError"));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("deleteConfirmTitle", { name: employee.name })}</DialogTitle>
          <DialogDescription>{t("deleteConfirmBody")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1 text-sm">
          {!!upcomingCount && (
            <p className="text-amber-700 dark:text-amber-400">
              {t("deleteUpcomingWarning", { count: upcomingCount })}
            </p>
          )}
          {soleServiceNames.length > 0 && (
            <p className="text-amber-700 dark:text-amber-400">
              {t("deleteSoleServiceWarning", { services: soleServiceNames.join(", ") })}
            </p>
          )}
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {tc("cancel")}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={busy}>
            {busy && <Spinner />}
            {tc("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
