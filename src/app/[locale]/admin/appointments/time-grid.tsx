"use client";

import { Ban, Pencil, Repeat, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type FormEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { AppointmentListItem, AppointmentStatus } from "@/lib/api/appointments";
import type { AvailabilityBlock } from "@/lib/api/availability-blocks";
import { ApiError } from "@/lib/api/client";
import type { Employee } from "@/lib/api/employees";
import { formatFullDate } from "@/lib/date";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import {
  type BlockFormErrors,
  type BlockFormValues,
  blockToFormValues,
  buildBlockTimeRange,
  defaultBlockForm,
  validateBlockForm,
} from "./block-form";
import {
  assignLanes,
  type BusinessHours,
  heightPx,
  type LunchWindow,
  minutesSinceMidnightInZone,
  SLOT_HEIGHT_PX,
  SLOT_MINUTES,
  topPx,
  zonedTimeToISOString,
} from "./calendar-grid";

const HOUR_GUTTER_PX = 64;

/**
 * Formats a whole-hour "minutes since midnight" mark as a short clock
 * label ("9 a.m."). Built on an arbitrary UTC-anchored date purely to
 * borrow Intl's hour formatting — minutes is already a wall-clock value
 * in the business's timezone, not a real instant, so no zone conversion
 * belongs here (unlike the appointment/block timestamps elsewhere in this
 * file, which are real instants and do go through minutesSinceMidnightInZone).
 */
function formatHourLabel(minutes: number, locale: string): string {
  const reference = new Date(Date.UTC(2000, 0, 1, Math.floor(minutes / 60), minutes % 60));
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    timeZone: "UTC",
  }).format(reference);
}

type ChipKind = AppointmentStatus | "BLOCKED" | "LUNCH";

const CHIP_STYLES: Record<
  ChipKind,
  { bg: string; border: string; bar: string; text: string; meta: string }
> = {
  CONFIRMED: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-900",
    bar: "bg-blue-500",
    text: "text-blue-900 dark:text-blue-100",
    meta: "text-blue-700 dark:text-blue-300",
  },
  COMPLETED: {
    bg: "bg-green-50 dark:bg-green-950/40",
    border: "border-green-200 dark:border-green-900",
    bar: "bg-green-600",
    text: "text-green-900 dark:text-green-100",
    meta: "text-green-700 dark:text-green-300",
  },
  MISSED: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-900",
    bar: "bg-amber-500",
    text: "text-amber-900 dark:text-amber-100",
    meta: "text-amber-700 dark:text-amber-300",
  },
  CANCELLED: {
    bg: "bg-red-50 dark:bg-red-950/40",
    border: "border-red-200 dark:border-red-900",
    bar: "bg-red-500",
    text: "text-red-900 dark:text-red-100",
    meta: "text-red-700 dark:text-red-300",
  },
  BLOCKED: {
    bg: "bg-zinc-100 dark:bg-zinc-800/60",
    border: "border-zinc-300 dark:border-zinc-700",
    bar: "bg-zinc-400 dark:bg-zinc-500",
    text: "text-zinc-700 dark:text-zinc-200",
    meta: "text-zinc-500 dark:text-zinc-400",
  },
  LUNCH: {
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-200 dark:border-orange-900",
    bar: "bg-orange-400 dark:bg-orange-600",
    text: "text-orange-900 dark:text-orange-100",
    meta: "text-orange-700 dark:text-orange-300",
  },
};

type GridEntry =
  | {
      kind: "appointment";
      key: string;
      startMinutes: number;
      endMinutes: number;
      appointment: AppointmentListItem;
    }
  | {
      kind: "block";
      key: string;
      startMinutes: number;
      endMinutes: number;
      block: AvailabilityBlock;
    }
  | {
      kind: "lunch";
      key: string;
      startMinutes: number;
      endMinutes: number;
      employeeId: string;
    };

export interface TimeGridDay {
  date: string;
  appointments: AppointmentListItem[];
  blocks: AvailabilityBlock[];
  businessHours: BusinessHours;
  /** Recurring lunch windows in effect for this date, one per employee that has one and hasn't skipped it — see lunchWindowsForDate. */
  lunchWindows: LunchWindow[];
}

/** State for the "Agregar cita"/"Marcar como ocupado" menu opened by clicking an empty slot — positioned at the click point, not anchored to the slot cell. */
interface SlotMenuState {
  x: number;
  y: number;
  date: string;
  startISO: string;
  endISO: string;
  /** The employee the menu acts on. Null when there's no single unambiguous one (an admin with several employees and no filter) — the menu itself then asks which employee, via the `employees` list. */
  employeeId: string | null;
}

/** State for the Edit/Cancel menu opened by clicking an existing busy block chip — positioned at the click point, the same way SlotMenuState is. */
interface BlockActionMenuState {
  x: number;
  y: number;
  block: AvailabilityBlock;
}

/** State for the create/edit "Mark busy" dialog. employeeId is fixed once opened — editing an existing block never reassigns its employee, only its range and description. */
interface BlockDialogState {
  mode: "create" | "edit";
  employeeId: string;
  /** Only set in edit mode. */
  blockId?: string;
  values: BlockFormValues;
}

export function TimeGrid({
  days,
  todayKey,
  timeZone,
  showEmployee,
  activeEmployeeId,
  employees,
  employeeIdsWithSchedule,
  locale,
  onAddAppointment,
  onMarkBusy,
  onUpdateBlock,
  onCancelBlock,
  onSkipLunch,
  onNoSchedule,
}: {
  days: TimeGridDay[];
  /** "YYYY-MM-DD" in the business's own timezone, for highlighting today's column and placing the now-line. */
  todayKey: string;
  timeZone: string;
  /** Appends the employee's name to a chip's meta line — an admin with no employee filter, viewing every employee's appointments in one column. */
  showEmployee: boolean;
  /** The single employee slot clicks act on, when unambiguous. Null for an admin with no employee filter — the empty-slot menu then asks which employee via `employees`, rather than being disabled outright. */
  activeEmployeeId: string | null;
  /** The business's employees, for the empty-slot menu's picker when activeEmployeeId is null, and for resolving a lunch chip's employee name when showEmployee is set. Null (not just empty) when there's no picker to offer — an employee caller always acts on their own record. */
  employees: Employee[] | null;
  /** Employee ids with at least one active working-hours schedule row — an empty-slot click for anyone outside this set can't lead anywhere, since there's no schedule for the appointment to occupy. See `onNoSchedule`. */
  employeeIdsWithSchedule: ReadonlySet<string>;
  locale: string;
  onAddAppointment: (params: {
    date: string;
    startISO: string;
    employeeId: string;
  }) => void;
  onMarkBusy: (params: {
    employeeId: string;
    startTime: string;
    endTime: string;
    reason?: string;
  }) => Promise<void>;
  onUpdateBlock: (params: {
    id: string;
    startTime: string;
    endTime: string;
    reason?: string;
  }) => Promise<void>;
  onCancelBlock: (id: string) => Promise<void>;
  onSkipLunch: (params: { employeeId: string; date: string }) => void;
  /** Fired instead of opening the empty-slot menu, when the slot's one unambiguous employee has no schedule configured at all. */
  onNoSchedule: (employeeId: string) => void;
}) {
  const t = useTranslations("Appointments");
  const tc = useTranslations("Common");
  // The grid's own scroll pane — this is the *only* scrolling element on
  // the page (the app shell around it is fixed-height), so the day-header
  // row can just be `position: sticky; top: 0` relative to it, with no
  // coordination with anything outside this component needed.
  const scrollPaneRef = useRef<HTMLDivElement | null>(null);
  // Set only on today's now-line (see DayColumnGrid) — used once on mount
  // to center this pane's scroll on the current time, the way Google
  // Calendar opens. null whenever today isn't in the visible range.
  const nowLineRef = useRef<HTMLDivElement | null>(null);
  // The grid-body wrapper (below the sticky day-header row) — used as the
  // measurement anchor for the noon fallback below, so that fallback
  // doesn't need to know the header's own height.
  const gridBodyRef = useRef<HTMLDivElement | null>(null);
  const [nowMinutes, setNowMinutes] = useState(() =>
    minutesSinceMidnightInZone(new Date().toISOString(), timeZone),
  );
  const [slotMenu, setSlotMenu] = useState<SlotMenuState | null>(null);
  // Set when a lunch chip is clicked, to confirm before actually calling
  // onSkipLunch — the styled Dialog below, not a native window.confirm, to
  // match every other destructive confirmation in this app.
  const [lunchSkipConfirm, setLunchSkipConfirm] = useState<{
    employeeId: string;
    date: string;
  } | null>(null);
  // The Edit/Cancel menu opened by clicking an existing busy block chip.
  const [blockActionMenu, setBlockActionMenu] =
    useState<BlockActionMenuState | null>(null);
  // The create/edit "Mark busy" dialog, opened either from the empty-slot
  // menu's "Marcar como ocupado" (create) or the block action menu's "Edit".
  const [blockDialog, setBlockDialog] = useState<BlockDialogState | null>(
    null,
  );
  // The block a "Cancel block" confirmation is pending for.
  const [blockCancelConfirm, setBlockCancelConfirm] =
    useState<AvailabilityBlock | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMinutes(minutesSinceMidnightInZone(new Date().toISOString(), timeZone));
    }, 30_000);
    return () => clearInterval(interval);
  }, [timeZone]);

  // The grid always covers the full day — business hours only decide which
  // rows get dimmed (see EmptySlotCell's isOutsideHours), not which rows
  // exist. Centering the scroll on the current time on open, the way
  // Google Calendar does, is what actually keeps the grid usable without
  // needing to clamp the range itself.
  const gridRange = useMemo(() => ({ start: 0, end: 24 * 60 }), []);

  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    for (let m = gridRange.start; m < gridRange.end; m += 60) marks.push(m);
    return marks;
  }, [gridRange]);

  const slotMarks = useMemo(() => {
    const marks: number[] = [];
    for (let m = gridRange.start; m < gridRange.end; m += SLOT_MINUTES) {
      marks.push(m);
    }
    return marks;
  }, [gridRange]);

  // Centers the pane's scroll once, on mount — not on every nowMinutes
  // tick, which would otherwise yank the scroll position back every 30s
  // while someone's browsing. When today is in the visible range, this
  // centers on the now-line, the way Google Calendar opens. Otherwise (a
  // past or future week/day) there's no now-line to measure, so it falls
  // back to centering on noon — a reasonable default view for a range that
  // isn't "right now" anyway.
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (scrolledRef.current) return;
    const pane = scrollPaneRef.current;
    if (!pane) return;
    const paneRect = pane.getBoundingClientRect();

    const nowLine = nowLineRef.current;
    if (nowLine) {
      scrolledRef.current = true;
      const lineRect = nowLine.getBoundingClientRect();
      const target = pane.scrollTop + (lineRect.top - paneRect.top) - pane.clientHeight / 2;
      pane.scrollTop = Math.max(0, target);
      return;
    }

    const body = gridBodyRef.current;
    if (!body) return;
    scrolledRef.current = true;
    const bodyRect = body.getBoundingClientRect();
    const noonTop =
      pane.scrollTop + (bodyRect.top - paneRect.top) + topPx(12 * 60, gridRange.start);
    const target = noonTop - pane.clientHeight / 2;
    pane.scrollTop = Math.max(0, target);
  }, [nowMinutes, gridRange.start]);

  return (
    <div ref={scrollPaneRef} className="h-full overflow-auto rounded-lg border">
      <div style={{ minWidth: HOUR_GUTTER_PX + days.length * 140 }}>
        <div
          className="bg-background sticky top-0 z-30 grid shadow-[0_1px_0_var(--border)]"
          style={{
            gridTemplateColumns: `${HOUR_GUTTER_PX}px repeat(${days.length}, minmax(0, 1fr))`,
          }}
        >
          <div className="border-r" />
          {days.map((day) => {
            const isToday = day.date === todayKey;
            const count = day.appointments.length;
            return (
              <div
                key={day.date}
                className={cn(
                  "flex flex-col items-center gap-0.5 border-r py-2",
                  isToday && "bg-primary/5",
                )}
              >
                <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  {new Intl.DateTimeFormat(locale, {
                    weekday: "short",
                    timeZone,
                  }).format(
                    new Date(zonedTimeToISOString(day.date, 12 * 60, timeZone)),
                  )}
                </span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-sm font-semibold",
                    isToday && "bg-primary text-primary-foreground",
                  )}
                >
                  {Number(day.date.slice(-2))}
                </span>
                <span className="text-muted-foreground h-3.5 text-[11px]">
                  {count > 0 && t("gridAppointmentCount", { count })}
                </span>
              </div>
            );
          })}
        </div>

        <div
          ref={gridBodyRef}
          className="grid"
          style={{
            gridTemplateColumns: `${HOUR_GUTTER_PX}px repeat(${days.length}, minmax(0, 1fr))`,
          }}
        >
          <div className="relative border-r">
            {hourMarks.map((m) => (
              <div key={m} style={{ height: SLOT_HEIGHT_PX * 2 }} className="relative">
                {m > gridRange.start && (
                  <span className="text-muted-foreground bg-background absolute top-0 right-1.5 -translate-y-1/2 px-0.5 text-[11px] whitespace-nowrap">
                    {formatHourLabel(m, locale)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {days.map((day) => (
            <DayColumnGrid
              key={day.date}
              day={day}
              gridRange={gridRange}
              slotMarks={slotMarks}
              isToday={day.date === todayKey}
              nowMinutes={nowMinutes}
              nowLineRef={day.date === todayKey ? nowLineRef : undefined}
              timeZone={timeZone}
              locale={locale}
              showEmployee={showEmployee}
              activeEmployeeId={activeEmployeeId}
              employees={employees}
              employeeIdsWithSchedule={employeeIdsWithSchedule}
              onOpenMenu={setSlotMenu}
              onRequestSkipLunch={setLunchSkipConfirm}
              onOpenBlockMenu={setBlockActionMenu}
              onNoSchedule={onNoSchedule}
            />
          ))}
        </div>
      </div>

      {slotMenu && (
        <SlotMenu
          state={slotMenu}
          employees={employees}
          employeeIdsWithSchedule={employeeIdsWithSchedule}
          locale={locale}
          timeZone={timeZone}
          onClose={() => setSlotMenu(null)}
          onAddAppointment={(employeeId) => {
            onAddAppointment({
              date: slotMenu.date,
              startISO: slotMenu.startISO,
              employeeId,
            });
            setSlotMenu(null);
          }}
          onMarkBusy={(employeeId) => {
            const startMinutes = minutesSinceMidnightInZone(
              slotMenu.startISO,
              timeZone,
            );
            setBlockDialog({
              mode: "create",
              employeeId,
              values: defaultBlockForm(
                slotMenu.date,
                startMinutes,
                t("blockDefaultReason"),
              ),
            });
            setSlotMenu(null);
          }}
        />
      )}

      {blockActionMenu && (
        <BlockActionMenu
          state={blockActionMenu}
          locale={locale}
          timeZone={timeZone}
          onClose={() => setBlockActionMenu(null)}
          onEdit={() => {
            const block = blockActionMenu.block;
            setBlockDialog({
              mode: "edit",
              employeeId: block.employee_id,
              blockId: block.id,
              values: blockToFormValues(block, timeZone),
            });
            setBlockActionMenu(null);
          }}
          onCancel={() => {
            setBlockCancelConfirm(blockActionMenu.block);
            setBlockActionMenu(null);
          }}
        />
      )}

      {blockDialog && (
        <BlockFormDialog
          state={blockDialog}
          timeZone={timeZone}
          onClose={() => setBlockDialog(null)}
          onCreate={onMarkBusy}
          onUpdate={onUpdateBlock}
        />
      )}

      {blockCancelConfirm && (
        <BlockCancelDialog
          block={blockCancelConfirm}
          onClose={() => setBlockCancelConfirm(null)}
          onConfirm={onCancelBlock}
        />
      )}

      <Dialog
        open={lunchSkipConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setLunchSkipConfirm(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("lunchSkipConfirmTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {t("lunchSkipConfirmBody")}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLunchSkipConfirm(null)}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (lunchSkipConfirm) onSkipLunch(lunchSkipConfirm);
                setLunchSkipConfirm(null);
              }}
            >
              {t("lunchSkipConfirmContinue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DayColumnGrid({
  day,
  gridRange,
  slotMarks,
  isToday,
  nowMinutes,
  nowLineRef,
  timeZone,
  locale,
  showEmployee,
  activeEmployeeId,
  employees,
  employeeIdsWithSchedule,
  onOpenMenu,
  onRequestSkipLunch,
  onOpenBlockMenu,
  onNoSchedule,
}: {
  day: TimeGridDay;
  gridRange: { start: number; end: number };
  slotMarks: number[];
  isToday: boolean;
  nowMinutes: number;
  /** Only set for today's column, so TimeGrid can measure this exact element's on-screen position to center the scroll pane's initial scroll on it. */
  nowLineRef?: RefObject<HTMLDivElement | null>;
  timeZone: string;
  locale: string;
  showEmployee: boolean;
  activeEmployeeId: string | null;
  employees: Employee[] | null;
  employeeIdsWithSchedule: ReadonlySet<string>;
  onOpenMenu: (state: SlotMenuState) => void;
  onRequestSkipLunch: (params: { employeeId: string; date: string }) => void;
  onOpenBlockMenu: (state: BlockActionMenuState) => void;
  onNoSchedule: (employeeId: string) => void;
}) {
  const entries = useMemo<GridEntry[]>(() => {
    const fromAppointments: GridEntry[] = day.appointments.map((a) => ({
      kind: "appointment",
      key: a.id,
      startMinutes: minutesSinceMidnightInZone(a.start_time, timeZone),
      endMinutes: minutesSinceMidnightInZone(a.end_time, timeZone),
      appointment: a,
    }));
    const fromBlocks: GridEntry[] = day.blocks.map((b) => ({
      kind: "block",
      key: b.id,
      startMinutes: minutesSinceMidnightInZone(b.start_time, timeZone),
      endMinutes: minutesSinceMidnightInZone(b.end_time, timeZone),
      block: b,
    }));
    const fromLunch: GridEntry[] = day.lunchWindows.map((l) => ({
      kind: "lunch",
      key: `lunch-${l.employeeId}`,
      startMinutes: l.startMinutes,
      endMinutes: l.endMinutes,
      employeeId: l.employeeId,
    }));
    return [...fromAppointments, ...fromBlocks, ...fromLunch];
  }, [day, timeZone]);

  const laned = useMemo(() => assignLanes(entries), [entries]);

  const busy = useMemo(() => {
    const covered = new Set<number>();
    for (const entry of entries) {
      for (let m = entry.startMinutes; m < entry.endMinutes; m += SLOT_MINUTES) {
        covered.add(m);
      }
    }
    return covered;
  }, [entries]);

  return (
    <div className={cn("relative border-r", isToday && "bg-primary/[0.02]")}>
      {slotMarks.map((m) => (
        <EmptySlotCell
          key={m}
          date={day.date}
          minutes={m}
          isBusy={busy.has(m)}
          isOutsideHours={
            m < day.businessHours.startMinutes || m >= day.businessHours.endMinutes
          }
          timeZone={timeZone}
          activeEmployeeId={activeEmployeeId}
          employeeIdsWithSchedule={employeeIdsWithSchedule}
          onOpenMenu={onOpenMenu}
          onNoSchedule={onNoSchedule}
        />
      ))}

      {laned.map(({ item, lane, lanes }) => (
        <GridChip
          key={item.key}
          entry={item}
          lane={lane}
          lanes={lanes}
          gridStart={gridRange.start}
          timeZone={timeZone}
          locale={locale}
          showEmployee={showEmployee}
          employees={employees}
          date={day.date}
          onRequestSkipLunch={onRequestSkipLunch}
          onOpenBlockMenu={onOpenBlockMenu}
        />
      ))}

      {isToday && nowMinutes >= gridRange.start && nowMinutes <= gridRange.end && (
        <div
          ref={nowLineRef}
          className="pointer-events-none absolute right-0 left-0 z-20 h-0.5 bg-red-500"
          style={{ top: topPx(nowMinutes, gridRange.start) }}
        >
          <span className="absolute top-1/2 -left-1 size-2.5 -translate-y-1/2 rounded-full bg-red-500" />
        </div>
      )}
    </div>
  );
}

function EmptySlotCell({
  date,
  minutes,
  isBusy,
  isOutsideHours,
  timeZone,
  activeEmployeeId,
  employeeIdsWithSchedule,
  onOpenMenu,
  onNoSchedule,
}: {
  date: string;
  minutes: number;
  isBusy: boolean;
  isOutsideHours: boolean;
  timeZone: string;
  activeEmployeeId: string | null;
  employeeIdsWithSchedule: ReadonlySet<string>;
  onOpenMenu: (state: SlotMenuState) => void;
  onNoSchedule: (employeeId: string) => void;
}) {
  const isHour = minutes % 60 === 0;

  const cellClassName = cn(
    "h-7",
    isHour ? "border-t" : "border-t border-dashed border-t-border/60",
    isOutsideHours && "bg-muted/40",
  );

  if (isBusy) {
    return <div className={cellClassName} />;
  }

  return (
    <button
      type="button"
      className={cn(cellClassName, "group hover:bg-primary/5 w-full text-left")}
      onClick={(event) => {
        // The one unambiguous employee this slot belongs to has no
        // schedule at all — there's nothing an "Agregar cita"/"Marcar
        // como ocupado" menu could meaningfully do here, so skip it
        // entirely rather than let it open onto a doomed flow. When
        // activeEmployeeId is null (an admin viewing every employee),
        // there's no single employee to check yet — the menu itself
        // still asks who, and checks there (see SlotMenu).
        if (activeEmployeeId && !employeeIdsWithSchedule.has(activeEmployeeId)) {
          onNoSchedule(activeEmployeeId);
          return;
        }
        onOpenMenu({
          x: event.clientX,
          y: event.clientY,
          date,
          startISO: zonedTimeToISOString(date, minutes, timeZone),
          endISO: zonedTimeToISOString(date, minutes + SLOT_MINUTES, timeZone),
          employeeId: activeEmployeeId,
        });
      }}
    >
      <span className="text-primary invisible pl-1.5 text-[11px] font-medium group-hover:visible">
        +
      </span>
    </button>
  );
}

/**
 * The "Agregar cita"/"Marcar como ocupado" menu for an empty slot, opened
 * at the exact click point rather than anchored to the slot cell — a
 * plain portal-rendered fixed menu instead of the shared Popover, so its
 * position is driven directly by the click coordinates.
 *
 * When state.employeeId is null (an admin with no employee filter), the
 * menu itself asks which employee to act on via a picker sourced from
 * `employees` — otherwise there'd be no way to tell which employee an
 * empty slot in a combined, multi-employee day column belongs to. Both
 * actions stay disabled until one is picked.
 */
/**
 * Positions a portal-rendered popup at an exact screen point (a click
 * coordinate) rather than anchored to a triggering element, clamped inside
 * the viewport once its own size is known. Shared by SlotMenu and
 * BlockActionMenu, which are otherwise just different content in the same
 * click-anchored popup shell.
 */
function usePositionedMenu(
  anchor: { x: number; y: number },
  onClose: () => void,
) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = Math.min(
      Math.max(anchor.x - rect.width / 2, 8),
      window.innerWidth - rect.width - 8,
    );
    const top = Math.min(anchor.y + 8, window.innerHeight - rect.height - 8);
    setPosition({ left, top });
  }, [anchor]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return { menuRef, position };
}

function PositionedMenu({
  anchor,
  onClose,
  children,
}: {
  anchor: { x: number; y: number };
  onClose: () => void;
  children: ReactNode;
}) {
  const { menuRef, position } = usePositionedMenu(anchor, onClose);

  return createPortal(
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        ref={menuRef}
        onClick={(event) => event.stopPropagation()}
        className="bg-popover text-popover-foreground ring-foreground/10 absolute w-56 rounded-xl p-1 text-sm ring-1 shadow-lg outline-none"
        style={
          position
            ? { left: position.left, top: position.top }
            : { left: anchor.x, top: anchor.y, visibility: "hidden" }
        }
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function SlotMenu({
  state,
  employees,
  employeeIdsWithSchedule,
  locale,
  timeZone,
  onClose,
  onAddAppointment,
  onMarkBusy,
}: {
  state: SlotMenuState;
  employees: Employee[] | null;
  employeeIdsWithSchedule: ReadonlySet<string>;
  locale: string;
  timeZone: string;
  onClose: () => void;
  onAddAppointment: (employeeId: string) => void;
  onMarkBusy: (employeeId: string) => void;
}) {
  const t = useTranslations("Appointments");
  const [pickedEmployeeId, setPickedEmployeeId] = useState("");
  const resolvedEmployeeId = state.employeeId ?? (pickedEmployeeId || null);
  // Only reachable here when state.employeeId is null (the pre-resolved
  // case is intercepted earlier, in EmptySlotCell, before this menu ever
  // opens) — i.e. this only fires once the in-menu picker below resolves
  // to a specific, schedule-less employee.
  const resolvedHasNoSchedule =
    !!resolvedEmployeeId && !employeeIdsWithSchedule.has(resolvedEmployeeId);

  return (
    <PositionedMenu anchor={state} onClose={onClose}>
      <div className="border-b px-2.5 py-2">
        <p className="text-sm font-semibold">
          {formatTime(state.startISO, timeZone, locale)} –{" "}
          {formatTime(state.endISO, timeZone, locale)}
        </p>
        <p className="text-muted-foreground text-xs">
          {formatFullDate(state.date, locale)}
        </p>
      </div>
      {state.employeeId === null && (
        <div className="border-b p-2">
          <Select
            aria-label={t("walkInEmployee")}
            value={pickedEmployeeId}
            onChange={(event) => setPickedEmployeeId(event.target.value)}
            className="h-8 text-xs"
          >
            <option value="" disabled>
              {t("walkInSelectEmployee")}
            </option>
            {employees?.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </Select>
          {resolvedHasNoSchedule && (
            <p className="text-amber-700 dark:text-amber-400 mt-1.5 text-xs">
              {t("slotMenuNoSchedule")}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-col gap-0.5 p-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="justify-start"
          disabled={!resolvedEmployeeId || resolvedHasNoSchedule}
          onClick={() => resolvedEmployeeId && onAddAppointment(resolvedEmployeeId)}
        >
          <UserPlus className="text-primary" />
          {t("addWalkIn")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="justify-start"
          disabled={!resolvedEmployeeId || resolvedHasNoSchedule}
          onClick={() => resolvedEmployeeId && onMarkBusy(resolvedEmployeeId)}
        >
          <Ban className="text-muted-foreground" />
          {t("gridMarkBusy")}
        </Button>
      </div>
    </PositionedMenu>
  );
}

/** The Edit/Cancel menu opened by clicking an existing busy block chip. */
function BlockActionMenu({
  state,
  locale,
  timeZone,
  onClose,
  onEdit,
  onCancel,
}: {
  state: BlockActionMenuState;
  locale: string;
  timeZone: string;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Appointments");

  return (
    <PositionedMenu anchor={state} onClose={onClose}>
      <div className="border-b px-2.5 py-2">
        <p className="text-sm font-semibold">
          {formatTime(state.block.start_time, timeZone, locale)} –{" "}
          {formatTime(state.block.end_time, timeZone, locale)}
        </p>
        {state.block.reason && (
          <p className="text-muted-foreground truncate text-xs">
            {state.block.reason}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="justify-start"
          onClick={onEdit}
        >
          <Pencil className="text-primary" />
          {t("blockMenuEdit")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive justify-start"
          onClick={onCancel}
        >
          <Ban />
          {t("blockMenuCancel")}
        </Button>
      </div>
    </PositionedMenu>
  );
}

/** The create/edit dialog behind both "Marcar como ocupado" (create) and the block action menu's "Edit". employeeId is fixed once opened; only the range and description are editable. */
function BlockFormDialog({
  state,
  timeZone,
  onClose,
  onCreate,
  onUpdate,
}: {
  state: BlockDialogState;
  timeZone: string;
  onClose: () => void;
  onCreate: (params: {
    employeeId: string;
    startTime: string;
    endTime: string;
    reason?: string;
  }) => Promise<void>;
  onUpdate: (params: {
    id: string;
    startTime: string;
    endTime: string;
    reason?: string;
  }) => Promise<void>;
}) {
  const t = useTranslations("Appointments");
  const tc = useTranslations("Common");
  const [values, setValues] = useState<BlockFormValues>(state.values);
  const [errors, setErrors] = useState<BlockFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function updateField(field: keyof BlockFormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateBlockForm(values, t);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const { startISO, endISO } = buildBlockTimeRange(values, timeZone);
    const reason = values.reason.trim() || undefined;

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (state.mode === "create") {
        await onCreate({
          employeeId: state.employeeId,
          startTime: startISO,
          endTime: endISO,
          reason,
        });
      } else {
        await onUpdate({
          id: state.blockId!,
          startTime: startISO,
          endTime: endISO,
          reason,
        });
      }
      onClose();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : t("blockSaveError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {state.mode === "create"
              ? t("blockDialogCreateTitle")
              : t("blockDialogEditTitle")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
          <FormField
            id="block-date"
            label={t("blockDate")}
            type="date"
            value={values.date}
            onChange={(v) => updateField("date", v)}
            error={errors.date}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="block-start"
              label={t("blockStart")}
              type="time"
              value={values.startTime}
              onChange={(v) => updateField("startTime", v)}
              error={errors.startTime}
            />
            <FormField
              id="block-end"
              label={t("blockEnd")}
              type="time"
              value={values.endTime}
              onChange={(v) => updateField("endTime", v)}
              error={errors.endTime}
            />
          </div>
          <FormField
            id="block-reason"
            label={tc("description")}
            optional
            optionalLabel={tc("optional")}
            value={values.reason}
            onChange={(v) => updateField("reason", v)}
          />
          {submitError && <p className="text-destructive text-sm">{submitError}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submitting}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting && <Spinner />}
              {submitting ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The "Cancel block" confirmation opened from the block action menu — a styled Dialog, not window.confirm, matching every other destructive confirmation in this app. */
function BlockCancelDialog({
  block,
  onClose,
  onConfirm,
}: {
  block: AvailabilityBlock;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}) {
  const t = useTranslations("Appointments");
  const tc = useTranslations("Common");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(block.id);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("blockCancelError"));
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("blockCancelConfirmTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          {t("blockCancelConfirmBody")}
        </p>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={submitting}
          >
            {tc("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting && <Spinner />}
            {t("blockCancelConfirmContinue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GridChip({
  entry,
  lane,
  lanes,
  gridStart,
  timeZone,
  locale,
  showEmployee,
  employees,
  date,
  onRequestSkipLunch,
  onOpenBlockMenu,
}: {
  entry: GridEntry;
  lane: number;
  lanes: number;
  gridStart: number;
  timeZone: string;
  locale: string;
  showEmployee: boolean;
  employees: Employee[] | null;
  date: string;
  onRequestSkipLunch: (params: { employeeId: string; date: string }) => void;
  onOpenBlockMenu: (state: BlockActionMenuState) => void;
}) {
  const t = useTranslations("Appointments");
  const kind: ChipKind =
    entry.kind === "block"
      ? "BLOCKED"
      : entry.kind === "lunch"
        ? "LUNCH"
        : entry.appointment.status;
  const style = CHIP_STYLES[kind];
  const top = topPx(entry.startMinutes, gridStart);
  const height = heightPx(entry.startMinutes, entry.endMinutes);
  const widthPct = 100 / lanes;
  const tight = height < 40;

  const positionStyle = {
    top,
    height,
    left: `calc(${lane * widthPct}% + 2px)`,
    width: `calc(${widthPct}% - 4px)`,
  };

  if (entry.kind === "block") {
    return (
      <button
        type="button"
        className={cn(
          "absolute z-10 overflow-hidden rounded-md border py-0.5 pr-1.5 pl-2 text-left text-xs transition-[filter] hover:brightness-95",
          style.bg,
          style.border,
        )}
        style={{
          ...positionStyle,
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(0,0,0,.035) 0 5px, transparent 5px 10px)",
        }}
        onClick={(event) =>
          onOpenBlockMenu({
            x: event.clientX,
            y: event.clientY,
            block: entry.block,
          })
        }
      >
        <span className={cn("block truncate font-semibold", style.text)}>
          {entry.block.reason || t("gridMarkBusy")}
        </span>
      </button>
    );
  }

  if (entry.kind === "lunch") {
    const employeeName = employees?.find((e) => e.id === entry.employeeId)?.name;
    return (
      <button
        type="button"
        title={t("lunchSkipTitle")}
        className={cn(
          "group absolute z-10 overflow-hidden rounded-md border py-0.5 pr-1.5 pl-2 text-left text-xs transition-[filter] hover:brightness-95",
          style.bg,
          style.border,
        )}
        style={positionStyle}
        onClick={() => onRequestSkipLunch({ employeeId: entry.employeeId, date })}
      >
        <span className={cn("absolute inset-y-0 left-0 w-[3px]", style.bar)} />
        <span className={cn("block truncate font-semibold", style.text)}>
          {t("lunchChipLabel")}
          {showEmployee && employeeName && ` · ${employeeName}`}
        </span>
        {!tight && (
          <span
            className={cn(
              "block truncate opacity-0 group-hover:opacity-100",
              style.meta,
            )}
          >
            {t("lunchSkipAction")}
          </span>
        )}
      </button>
    );
  }

  const appointment = entry.appointment;

  return (
    <Link
      href={`/admin/appointments/${appointment.id}`}
      className={cn(
        "absolute z-10 block overflow-hidden rounded-md border py-0.5 pr-1.5 pl-2 text-xs transition-[filter] hover:brightness-95",
        style.bg,
        style.border,
        appointment.status === "CANCELLED" && "opacity-65",
      )}
      style={positionStyle}
    >
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", style.bar)} />
      <span
        className={cn(
          "flex items-center gap-1 truncate font-semibold",
          style.text,
          appointment.status === "CANCELLED" && "line-through",
        )}
      >
        {appointment.recurring_appointment_id && (
          <Repeat
            className="size-3 shrink-0"
            aria-label={t("recurringIndicator")}
          />
        )}
        <span className="truncate">{appointment.customer.name}</span>
      </span>
      {!tight && (
        <span className={cn("block truncate", style.meta)}>
          {formatTime(appointment.start_time, timeZone, locale)} ·{" "}
          {appointment.service.name}
          {showEmployee && ` · ${appointment.employee.name}`}
        </span>
      )}
    </Link>
  );
}
