"use client";

import { useTranslations } from "next-intl";
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
import { ApiError } from "@/lib/api/client";
import { type Employee, getCurrentEmployee, listEmployees } from "@/lib/api/employees";
import {
  createService,
  deleteService,
  type Service,
  listServices,
  updateService,
} from "@/lib/api/services";
import { DEFAULT_CURRENCY_SYMBOL, formatPrice } from "@/lib/format";
import { useBusinessSettings } from "../business-context";
import { hasPermission, useSession } from "../session-context";
import {
  filterServices,
  type SortColumn,
  type SortState,
  sortServices,
} from "./service-filter";
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
  const session = useSession();
  const tc = useTranslations("Common");

  if (!hasPermission(session, "manage_services")) {
    return <p className="text-muted-foreground text-sm">{tc("noAccess")}</p>;
  }

  return session.role === "admin" ? (
    <AdminServiceManagement />
  ) : (
    <OwnServiceManagement />
  );
}

/** create: the Add button opens an empty ServiceFormDialog. edit: it opens pre-filled for that service. delete: DeleteServiceDialog is showing for that service. */
type ModalState =
  | { mode: "create" }
  | { mode: "edit"; service: Service }
  | { mode: "delete"; service: Service }
  | null;

/** An admin manages the whole catalog, including which employees each service is associated with. */
function AdminServiceManagement() {
  const t = useTranslations("Services");
  const [services, setServices] = useState<Service[] | null>(null);
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

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

  useEffect(() => {
    listEmployees()
      .then(setEmployees)
      .catch(() => {
        // The employee picker just won't show if this fails; the rest of
        // the page still works, services just can't be re-associated.
      });
  }, []);

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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <Button size="sm" onClick={() => setModal({ mode: "create" })}>
          <Plus data-icon="inline-start" />
          {t("addService")}
        </Button>
      </div>

      <ServicesCatalog
        services={services}
        employees={employees}
        onReload={reload}
        modal={modal}
        onModalChange={setModal}
      />
    </div>
  );
}

/** A permitted employee manages only their own services — no employee picker, since it's always just themselves. */
function OwnServiceManagement() {
  const t = useTranslations("Services");
  const [services, setServices] = useState<Service[] | null>(null);
  const [ownEmployeeId, setOwnEmployeeId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

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

  useEffect(() => {
    getCurrentEmployee()
      .then((employee) => setOwnEmployeeId(employee.id))
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : t("loadError"));
      });
  }, [t]);

  if (loadError) {
    return <p className="text-destructive text-sm">{loadError}</p>;
  }

  if (!services || !ownEmployeeId) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  const ownServices = services.filter((s) => s.employee_ids.includes(ownEmployeeId));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <Button size="sm" onClick={() => setModal({ mode: "create" })}>
          <Plus data-icon="inline-start" />
          {t("addService")}
        </Button>
      </div>

      <ServicesCatalog
        services={ownServices}
        employees={null}
        onReload={reload}
        modal={modal}
        onModalChange={setModal}
      />
    </div>
  );
}

/** Toolbar (search) + sortable table + the create/edit/delete dialogs, shared by both the admin and the employee's own view. */
function ServicesCatalog({
  services,
  employees,
  onReload,
  modal,
  onModalChange,
}: {
  services: Service[];
  employees: Employee[] | null;
  onReload: () => void;
  modal: ModalState;
  onModalChange: (modal: ModalState) => void;
}) {
  const t = useTranslations("Services");
  const tc = useTranslations("Common");
  const { business } = useBusinessSettings();
  const currencySymbol = business?.currency_symbol ?? DEFAULT_CURRENCY_SYMBOL;

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>({
    column: "name",
    direction: "asc",
  });

  const visible = useMemo(
    () => sortServices(filterServices(services, query), sort),
    [services, query, sort],
  );

  function toggleSort(column: SortColumn) {
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="search"
        placeholder={t("searchPlaceholder")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="max-w-xs"
      />

      {services.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noServicesYet")}</p>
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
                className="w-56"
              />
              <SortableHeader
                column="duration_minutes"
                label={t("duration")}
                sort={sort}
                onSort={toggleSort}
                className="w-28"
              />
              <SortableHeader
                column="price"
                label={t("price")}
                sort={sort}
                onSort={toggleSort}
                className="w-24"
              />
              {employees && <TableHead>{t("employees")}</TableHead>}
              <TableHead className="w-28 text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((service) => (
              <ServiceTableRow
                key={service.id}
                service={service}
                employees={employees}
                currencySymbol={currencySymbol}
                onEdit={() => onModalChange({ mode: "edit", service })}
                onDelete={() => onModalChange({ mode: "delete", service })}
              />
            ))}
          </TableBody>
        </Table>
      )}

      {(modal?.mode === "create" || modal?.mode === "edit") && (
        <ServiceFormDialog
          employees={employees}
          service={modal.mode === "edit" ? modal.service : null}
          onClose={() => onModalChange(null)}
          onSaved={() => {
            onModalChange(null);
            onReload();
          }}
        />
      )}

      {modal?.mode === "delete" && (
        <DeleteServiceDialog
          service={modal.service}
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

function ServiceTableRow({
  service,
  employees,
  currencySymbol,
  onEdit,
  onDelete,
}: {
  service: Service;
  employees: Employee[] | null;
  currencySymbol: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("Services");
  const tc = useTranslations("Common");

  const employeeNames = employees
    ? service.employee_ids
        .map((id) => employees.find((e) => e.id === id)?.name)
        .filter((name): name is string => Boolean(name))
        .join(", ")
    : null;

  return (
    <TableRow>
      <TableCell>
        <p className="truncate font-medium">{service.name}</p>
        {service.description && (
          <p className="text-muted-foreground truncate text-xs">{service.description}</p>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {service.duration_minutes} {t("minutesAbbrev")}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatPrice(service.price, currencySymbol)}
      </TableCell>
      {employees && (
        <TableCell className="overflow-hidden">
          {employeeNames ? (
            <p className="text-muted-foreground truncate" title={employeeNames}>
              {employeeNames}
            </p>
          ) : (
            <Badge variant="warning" title={t("noEmployeesAssignedHint")}>
              {t("noEmployeesAssignedChip")}
            </Badge>
          )}
        </TableCell>
      )}
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
          {employees && (
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
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function EmployeeCheckboxList({
  employees,
  selectedIds,
  onChange,
  idPrefix,
}: {
  employees: Employee[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  idPrefix: string;
}) {
  const t = useTranslations("Services");

  function toggle(employeeId: string, checked: boolean) {
    onChange(
      checked
        ? [...selectedIds, employeeId]
        : selectedIds.filter((id) => id !== employeeId),
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{t("employees")}</span>
      <div className="flex flex-col gap-1">
        {employees.map((employee) => (
          <label
            key={employee.id}
            htmlFor={`${idPrefix}-employee-${employee.id}`}
            className="flex items-center gap-2 text-sm select-none"
          >
            <input
              id={`${idPrefix}-employee-${employee.id}`}
              type="checkbox"
              checked={selectedIds.includes(employee.id)}
              onChange={(event) => toggle(employee.id, event.target.checked)}
              className="accent-primary size-3.5"
            />
            {employee.name}
          </label>
        ))}
      </div>
      {selectedIds.length === 0 && (
        <p className="text-amber-700 dark:text-amber-400 text-xs">
          {t("noProfessionalsWarning")}
        </p>
      )}
    </div>
  );
}

/** Create when service is null, edit otherwise. Only ever mounted while its modal is open, so its state initializes fresh from `service` every time it's opened. */
function ServiceFormDialog({
  employees,
  service,
  onClose,
  onSaved,
}: {
  employees: Employee[] | null;
  service: Service | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("Services");
  const tc = useTranslations("Common");
  const tf = useTranslations("ServiceForm");
  const [values, setValues] = useState<ServiceFormValues>(() =>
    service ? serviceToFormValues(service) : EMPTY_SERVICE_FORM,
  );
  const [employeeIds, setEmployeeIds] = useState<string[]>(
    () => service?.employee_ids ?? [],
  );
  const [errors, setErrors] = useState<ServiceFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  const dirty =
    JSON.stringify(values) !==
      JSON.stringify(service ? serviceToFormValues(service) : EMPTY_SERVICE_FORM) ||
    (employees !== null &&
      JSON.stringify([...employeeIds].sort()) !==
        JSON.stringify([...(service?.employee_ids ?? [])].sort()));

  function updateField(field: keyof ServiceFormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function requestClose() {
    if (dirty) {
      setConfirmDiscardOpen(true);
    } else {
      onClose();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateServiceForm(values, tf);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (service) {
        const patch = buildServicePatch(values, service);
        if (
          employees &&
          JSON.stringify([...employeeIds].sort()) !==
            JSON.stringify([...service.employee_ids].sort())
        ) {
          patch.employee_ids = employeeIds;
        }
        if (Object.keys(patch).length > 0) {
          await updateService(service.id, patch);
        }
      } else {
        const params = buildCreateServiceParams(values);
        if (employees) params.employee_ids = employeeIds;
        await createService(params);
      }
      onSaved();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : t("createError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) requestClose(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{service ? t("editTitle") : t("addTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
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
            {employees && (
              <EmployeeCheckboxList
                employees={employees}
                selectedIds={employeeIds}
                onChange={setEmployeeIds}
                idPrefix={service?.id ?? "create"}
              />
            )}
            {submitError && <p className="text-destructive text-sm">{submitError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={requestClose} disabled={submitting}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Spinner />}
                {submitting ? tc("adding") : tc("save")}
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

function DeleteServiceDialog({
  service,
  onClose,
  onDeleted,
}: {
  service: Service;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("Services");
  const tc = useTranslations("Common");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteService(service.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("deleteError"));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
          <DialogDescription>{t("deleteConfirmBody")}</DialogDescription>
        </DialogHeader>
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
