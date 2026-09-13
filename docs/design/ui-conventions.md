# Admin list-page convention

Every admin section that manages a collection of tenant resources (services,
employees, and eventually schedules) follows the same shape, so a user who's
learned one already knows the others.

## Layout

- A header row: page title on the left, a primary "Add X" button on the
  right.
- A toolbar row: a text search input (client-side, filters by name) plus one
  or more `Select` dropdowns for status/category filters.
- A `Table` (`src/components/ui/table.tsx`) below, not a stack of `Card`s.
  Sortable columns have a clickable header (name + an up/down/neutral arrow
  icon from `lucide-react`) that toggles ascending/descending on click.
- Row actions are icon-only `Button`s (`variant="ghost" size="icon-sm"`) on
  the right: `Pencil` to edit, `Trash2` for a permanent delete. Every icon
  button carries `title`/`aria-label` text, since there's no visible label.
  There's no reversible active/inactive toggle on these resources — it
  turned out nobody actually used it, so it was replaced with delete
  entirely rather than kept alongside it.

See `src/app/[locale]/admin/services/page.tsx` for the reference
implementation, and `src/app/[locale]/admin/services/service-filter.ts` for
the pure filter/sort functions a page like this needs (kept separate from
the component so they're unit-testable without rendering anything).

## Create and edit: one Dialog, two modes

A single `<Something>FormDialog` component handles both create (no existing
record) and edit (pre-filled from one). It's only ever mounted while its
modal is open — conditionally rendered by the parent, not toggled via a
`hidden` `open` prop — so its internal form state always initializes fresh
from whatever it's editing (or from an empty form, for create) with a plain
`useState(() => ...)`, no reset effect needed.

**Unsaved-changes guard**: the dialog computes a `dirty` boolean by comparing
current form state against the initial snapshot it mounted with. Its
`Dialog`'s `onOpenChange` never closes the dialog directly — it calls a
`requestClose()` that shows a small nested confirm dialog ("Unsaved
changes" / "Keep editing" vs. "Discard and close") when dirty, and closes
immediately otherwise. This covers the X button, Escape, backdrop click, and
an explicit Cancel button uniformly, since they all route through the same
`onOpenChange`. See `ServiceFormDialog` in the services page, or the fuller
version of the same idea (guarding route navigation instead of a dialog
close) in `src/app/[locale]/admin/appointments/[id]/appointment-detail.tsx`.

## Delete: a separate confirm dialog, and it means "gone"

Deleting is its own small `<Something>DeleteDialog` — title, one sentence
explaining it can't be undone, Cancel + a `variant="destructive"` confirm
button. It's the only way to retire a resource; there's no separate
reversible "deactivate" action anymore. For a resource with real
appointment/history rows that must never be orphaned (services, employees),
the backend keeps the deleted record's row so past history can still resolve
its name, it just stops returning it from the list endpoint and refuses any
further edit to it. See "Real (irreversible) soft-delete" in `mi-agenda-api`'s
`docs/api/endpoints-reference.md` (`DELETE /services/{id}`, `DELETE
/employees/{id}`) for the backend half of this pattern.

## Blocking an action the resource genuinely can't support yet

If an action would create a resource in a state the rest of the system can't
use (e.g. a service with nobody able to perform it), don't let the create
form render empty and fail — show a small explanatory dialog instead of the
form, with a way to fix the missing prerequisite (a button linking to where
it's created). See `NeedEmployeeDialog` in the services page.
