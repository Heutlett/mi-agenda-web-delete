# Backlog — mi-agenda-web MVP

Scope: a Next.js + Tailwind frontend covering both experiences described in [mi-agenda-api/docs/planning/design.md](../../../mi-agenda-api/docs/planning/design.md): the public, no-auth booking site at `/:slug`, and the authenticated admin dashboard. The backend contract it consumes is fully specified in [mi-agenda-api/docs/api/endpoints-reference.md](../../../mi-agenda-api/docs/api/endpoints-reference.md); this backlog assumes that API is already built and stable (`mi-agenda-api` v0.1.0).

Payments, WhatsApp booking, native apps, multi-location, analytics, loyalty/promotions, calendar integrations, waitlists, recurring appointments, subscriptions, invoicing, and marketplace features are out of scope, per design.md §24. Don't build toward them speculatively.

Priority: **P0** = blocks the core booking loop or admin usability, **P1** = required before calling 0.1.0 done, **P2** = can slip to 0.1.1 without breaking the MVP story.

ETAs assume Claude-Code-assisted implementation (scaffolding, boilerplate components, and API wiring generated/edited with AI assistance, then reviewed by a human) — not solo manual coding. They cover implementation + basic component/e2e tests, not design debate.

## UX reference notes

[zeeg.me/richbarber22](https://zeeg.me/richbarber22) was reviewed live (rendered with a headless browser, since it's a client-rendered SPA) as UX inspiration for the public booking flow, not as a spec — mi-agenda's domain model, copy, and branding stay our own. Observed patterns worth carrying over:

- A single centered card, capped width, on a neutral light background — this holds even on desktop; the booking flow never goes multi-column.
- Business header: circular logo/avatar, business name as the page heading, a short welcome line, and a row of contact icons (email, phone, WhatsApp).
- Each service renders as its own card: name, optional expandable notes ("Más" / "Show more"), a duration badge, and a colored CTA button that advances to that service's booking flow.
- Employee selection is conditional: this particular business has a single provider, so choosing a service goes straight to the date picker with no employee-picker screen. mi-agenda must replicate that conditional — show an employee-selection step only when a business has more than one active employee, otherwise auto-select the sole one and skip straight to date selection. This is the reference site validating design.md §22's "minimal steps" requirement in practice.
- Date picker: a month-grid calendar, days with any open slot visually distinguished from days with none, month navigation arrows, no jumping to a separate page.
- Time picker: a flat list of available start times for the selected date, with a 12h/24h display toggle and the resolved timezone shown alongside it.
- Contact step: a short form (name, email, phone) directly below the confirmed date/time, ending in one full-width confirm button. mi-agenda's version drops the "add guest emails" field (out of scope) and makes email optional rather than required, per design.md §12 and `CLAUDE.md`.
- Every step keeps a visible "back" affordance and a persistent summary of what's already been chosen (date/time, service), so the customer is never lost mid-flow.

## Phase 1 — Project Foundation

| Priority | Task                                 | Description                                                                                              | ETA  | Progress |
| -------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---- | -------- |
| P0       | Repo & tooling setup                 | Next.js (App Router) + TypeScript scaffold, Tailwind config, ESLint/Prettier, env config conventions     | 1–2h | Done     |
| P0       | API client layer                     | Typed fetch wrapper against `mi-agenda-api`, base URL from env, centralized error/HTTP-status handling   | 2–3h | Done     |
| P0       | Route structure                      | Public `/:slug` booking route group, authenticated `/admin/*` route group, shared layout shells for each | 1–2h | Done     |
| P1       | Design tokens & shared UI primitives | Tailwind theme (color, spacing, type scale), base components: button, input, card, badge, spinner        | 2–3h | Done     |
| P1       | Dev environment docs                 | `.env.example`, README setup/run/test instructions, linking to `mi-agenda-api`'s local setup             | 1h   | Done     |

## Phase 2 — Public Booking Site

| Priority | Task                             | Description                                                                                                                                                                                | ETA  | Progress |
| -------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | -------- |
| P0       | Business landing page            | `GET /businesses/{slug}`: header (logo placeholder, name, contact info), active services list; 404 state for an unknown/inactive slug                                                      | 2–3h | Done     |
| P0       | Service selection                | Service cards (name, description, duration, price) with a CTA into that service's booking flow                                                                                             | 1–2h | Done     |
| P0       | Employee selection (conditional) | Shown only when the business has more than one active employee; otherwise auto-selected and skipped, per the UX reference notes above                                                      | 1–2h | Done     |
| P0       | Date selection                   | Month-grid calendar in the business's timezone, month navigation, no selection of days that can't have availability (past dates)                                                           | 2–3h | Done     |
| P0       | Time slot selection              | `GET /availability` for the chosen employee/service/date; empty state when a date has no open slots                                                                                        | 2h   | Done     |
| P0       | Customer contact form            | Phone and name required, phone shown first since it drives the lookup and verification below; email isn't collected in this form for now (still supported by `mi-agenda-api` itself). Client-side validation only, never a substitute for backend validation | 1–2h | Done     |
| P1       | Fixed country code on phone      | `506` is prepended to the local number the customer types for every WhatsApp/API call, no country selector, since every customer is Costa Rican for now — but only if it isn't already there: `normalizePhone` (`contact-form-phone.ts`) strips formatting first and skips prepending if the input already starts with `506`, so pasting `"50688393511"` or `"+506 8839-3511"` doesn't double up. Fixes the real delivery failures a missing country code caused (`(#131030) Recipient phone number not in allowed list`). Mirrored server-side in `mi-agenda-api`'s `internal/phone`. The verification dialog still shows the number back exactly as typed, without the prepended code | 1h | Done |
| P0       | Booking confirmation             | `POST /appointments`; success screen with appointment details; `409` handled by sending the customer back to time selection with a "that slot was just taken" message, not a generic error | 2–3h | Done     |
| P1       | Booking flow state & navigation  | Back/forward through steps without losing prior selections; persistent summary of date/time/service as the flow progresses                                                                 | 2h   | Done     |
| P1       | Mobile-first responsive pass     | Verify the full flow on small viewports first, then confirm it degrades sensibly on tablet/desktop                                                                                         | 1–2h | Done     |
| P2       | Loading & error states polish    | Skeleton/spinner states for every network call, distinct copy for 404 vs 409 vs network failure                                                                                            | 1–2h | Done     |
| P0       | Phone verification during booking | Mandatory, not opt-in, and folded into the single "Confirmar reserva" button: clicking it opens a modal that sends the code (`POST /phone-verifications`) and confirms it (`.../confirm`); a successful confirm closes the modal and books automatically, no second click. Shows a live countdown to the code's real expiry, and a "Resend code" action with its own 30-second cooldown, independent of the full expiry. Always re-verified — a phone verified on an earlier booking still needs a fresh code, since skipping that would let anyone book under a number they don't hold. Outside production, `mi-agenda-api` returns the code directly in its response and the modal pre-fills it, since there's no real WhatsApp template to receive it from yet. Verified live with a real WhatsApp code, the dev-mode auto-fill, and the resend flow | 2h   | Done     |
| P1       | Returning-customer auto-fill by verified phone | A debounced lookup (`POST /phone-verifications/lookup`) fires once the phone field looks complete; if the phone has saved data from a prior booking, the name field is filled in directly and a small note explains it can still be changed. Never overwrites anything the customer already typed. Loading the data doesn't skip the mandatory verification above. Verified live against a real previously-verified customer | 1–2h | Done     |

## Phase 3 — Admin Authentication

| Priority | Task                  | Description                                                                                                                                                 | ETA  | Progress |
| -------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------- |
| P0       | Login page            | `POST /auth/login`; stores access + refresh tokens; redirects into `/admin` on success                                                                      | 2h   | Done     |
| P0       | Auth session handling | Access token attached to authenticated requests; silent refresh via `POST /auth/refresh` on expiry; logout clears both tokens and calls `POST /auth/logout` | 2–3h | Done     |
| P0       | Route protection      | Unauthenticated access to `/admin/*` redirects to login; role known from `GET /auth/me` gates admin-only screens                                            | 1–2h | Done     |
| P1       | Forgot/reset password | `POST /auth/forgot-password` request form and `POST /auth/reset-password` form from the emailed/logged token link                                           | 2h   | Done     |
| P2       | Session expiry UX     | Graceful redirect-to-login with a preserved return path when a refresh ultimately fails                                                                     | 1h   | Done     |
| P2       | Login with email or phone | The login form's single identifier field accepts either an email or a phone number, matching `mi-agenda-api`'s Phase 5 "Phone column & dual-identifier login for `users`," not yet built | 1h   | Not started |

## Phase 4 — Admin Dashboard: Business & Domain Management

| Priority | Task                      | Description                                                                                                                | ETA  | Progress |
| -------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---- | -------- |
| P0       | Admin shell & navigation  | Authenticated layout: nav between business settings, employees, services, schedules, availability, appointments, customers. Top bar identifies who's logged in (name) and which dashboard they're in (an Admin/Employee badge), and links to change password (reuses the existing forgot-password flow) | 1–2h | Done     |
| P1       | Business settings         | View/edit own business via `GET`/`PATCH /businesses/me`                                                                    | 1–2h | Done     |
| P0       | Employee management       | List, invite (`POST /users` + `POST /employees`), edit, deactivate employees                                               | 3–4h | Done     |
| P0       | Service management        | List, create, edit, deactivate services (name, description, duration, price)                                               | 2–3h | Done     |
| P0       | Working hours (schedules) | Per-employee weekly schedule editor: add/edit/deactivate day/start/end blocks                                              | 3–4h | Done     |
| P1       | Availability blocks       | Per-employee one-off blocks (vacation, break, closure) with reason, create and delete                                      | 2h   | Done     |

## Phase 5 — Admin Dashboard: Appointments & Customers

| Priority | Task                         | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | ETA  | Progress |
| -------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | -------- |
| P0       | Calendar view                | Daily and weekly views over `GET /appointments`, filterable by employee (admin only; employees are always scoped to their own)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 4–5h | Done     |
| P1       | Quick time-off from calendar | Click a slot directly in the weekly calendar to create an availability block for that employee/day/time (e.g. a mid-day appointment), instead of typing exact timestamps into the Availability blocks form; reuses that view's grid and the existing `createAvailabilityBlock` call. Blocked on a real gap found while scoping this: an `employee`-role user has no way to discover their own `employee_id` anywhere in the API (`GET /auth/me` doesn't include it, `GET /employees` is admin-only), so employee self-service isn't buildable as-is — needs a small `mi-agenda-api` addition (e.g. `employee_id` on `GET /auth/me`, or a `GET /employees/me`) before this can cover both roles. Deliberately skipped for now, to revisit once that's decided | 2–3h | Skipped  |
| P0       | Appointment list & filters   | List view with employee/date-range/status filters as an alternative to the calendar                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 2h   | Done     |
| P1       | Appointment detail           | `GET /appointments/{id}` with embedded employee/service/customer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 1–2h | Done     |
| P0       | Appointment status changes   | Set status via `PATCH /appointments/{id}`, gated by a confirmation dialog (with a "don't ask again" opt-out persisted in `localStorage`) to guard against misclicks. An admin, or an employee with the `edit_appointment_status` permission, can set any status anytime, including back to CONFIRMED; a plain employee keeps the original one-way CONFIRMED → CANCELLED/COMPLETED/MISSED                                                                                                                                                                                                                                                                                                                                                                | 2–3h | Done     |
| P1       | Customer management          | Search (`GET /customers?q=`) and list; a customer's appointment history via `GET /appointments?customer_id=`, filterable by status, service, and date range (options for status/service come from the customer's own history, not a separate lookup). Summary tiles (total, completed, missed — all-time, from `GET /customers/{id}`) alongside the recent-miss warning (rolling 30 days, a distinct number from the all-time total)                                                                                                                                                                                                                                                                                                                    | 2–3h | Done     |

## Phase 6 — Internationalization (Spanish/English)

| Priority | Task                          | Description                                                                                                                                                                    | ETA  | Progress |
| -------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------- |
| P0       | Locale routing & framework setup | `next-intl` with locale-prefixed routing (`/es/...`, `/en/...`), Spanish as the default locale, English fully supported, per the initial Costa Rican market                | 2–3h | Done     |
| P0       | Public booking site translation | Full text extraction for the `/:slug` booking flow (service list, employee/date/time selection, contact form, confirmation, error/not-found states)                        | 2–3h | Done     |
| P0       | Admin dashboard translation     | Full text extraction across business settings, employees, services, schedules, availability, appointments, customers, and the auth flows (login/forgot/reset password)     | 3–4h | Done     |
| P1       | Locale-aware date/time formatting | Threaded a `locale` parameter through the shared date/time formatting helpers and weekday/month labels, replacing hardcoded `en-US` formatting                             | 1–2h | Done     |
| P1       | Language switcher               | A locale switcher in the public booking layout, the admin dashboard header, and the home page, preserving the current page and query params                               | 1h   | Done     |

## Phase 7 — Basic Revenue Tracking

Deliberately minimal, not a reporting/analytics dashboard: per-appointment price edits and day/week/month totals, nothing else. Depends on `mi-agenda-api`'s own Phase 7.

| Priority | Task                       | Description                                                                                                                                                          | ETA  | Progress    |
| -------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------- |
| P1       | Editable appointment price | Inline price edit on the appointment detail page, for cases where the actual charge differed from the service's price. Visible for an employee's own appointments, or any appointment for an admin | 1–2h | Done |
| P1       | Employee earnings summary  | A day/week/month toggle showing the logged-in employee's own total                                                                                                  | 2h   | Done |
| P1       | Admin earnings summary     | Same day/week/month toggle, plus a per-employee breakdown and the business-wide total across all employees                                                        | 2h   | Done |
| P1       | History page: appointment history + filters | Replaced the bare totals page with `/admin/history`: a filterable appointment history (employee filter for an admin with more than one employee, day/week/month toggle) with the revenue totals for that same filter shown alongside. Drops the old "Revenue"/"Ingresos" naming and layout | 3–4h | Done |
| P1       | Price-undefined warning when completing | The status-change confirmation dialog warns when marking an appointment COMPLETED with no price set yet: the service's current price will be used as a default | 1–2h | Done |
| P2       | More prominent price display | Redesigned the appointment detail page's price as a chip instead of plain text | 1h | Done |
| P1       | Appointment card redesign: chips and clearer affordances | Service name, duration, and price shown as icon+chip elements (price with the business's configurable currency symbol) on the appointment detail page and the new history list; the customer name link gets an icon indicating it opens the customer's own card. Not yet applied to the main Appointments page's own calendar/day/week cards | 2–3h | Partially done |
| P1       | Appointment payment status | A payment-status chip (`Pagado`/`Pendiente`/`Moroso`) on the appointment detail page, editable the same way as price; a matching filter and chip on the history page | 2h | Done |
| P1       | One combined save action per appointment edit | Editing price and payment status together on the appointment detail page now saves through a single Guardar/Cancelar pair and one `PATCH /appointments/{id}` call, never two separate pairs regardless of how many of the two fields changed | 1h | Done |
| P2       | Labeled appointment detail chips | Each chip on the appointment detail page (service, duration, price, payment status) now carries a small label naming what it shows | 1h | Done |
| P1       | Required service price | Matches `mi-agenda-api`'s own required `services.price`: the service create/edit form no longer treats price as optional | 1h | Done |
| P1       | Business-wide price visibility toggle | A "Show prices to customers" toggle on the business settings page, visible to an admin always and to an employee once granted the new `manage_price_visibility` permission (a checkbox on the employees page); saves via the dedicated `PATCH /businesses/{id}/price-visibility` endpoint | 2h | Done |
| P1       | Customer and appointment detail pages as modals | Both open as a modal over whatever admin page they're reached from (a single `@modal` parallel-route slot at the `admin/` layout level, intercepting `(.)appointments/[id]` and `(.)customers/[id]`), closable via the X, Escape, backdrop click, or the browser back button, always returning to exactly where it was opened from — including modal-over-modal (e.g. opening a customer from within the appointment modal, then closing back to it). A direct URL or hard refresh still renders the real full page, unchanged; all existing editing/unsaved-changes-guard logic on the appointment page was extracted, not duplicated, and works identically in both contexts | 4–6h | Done |
| P1       | WhatsApp contact on appointment detail | A "message on WhatsApp" action for the appointment's customer, the same wa.me pattern already used for contacting the business from a booking-rejection error | 1h | Done |

## Release Readiness

| Priority | Task                        | Description                                                                                                   | ETA  | Progress    |
| -------- | --------------------------- | ------------------------------------------------------------------------------------------------------------- | ---- | ----------- |
| P1       | Env vars & config for prod  | Production API base URL and any build-time config separated from dev                                          | 1h   | Not started |
| P1       | Basic CI                    | Lint/typecheck/build (and test, once tests exist) on PR                                                       | 1–2h | Not started |
| P0       | Deploy                      | Ship to chosen static/edge hosting target, scale-to-zero preferred per `CLAUDE.md`'s cost-efficiency guidance | 2–3h | Not started |
| P2       | Basic error/monitoring hook | Client-side error boundary reporting, so a broken booking flow in production is visible                       | 1–2h | Not started |
| P1       | Usage analytics | Track which admin pages/features are actually used, and which aren't, plus the public booking funnel's step-by-step drop-off and load/interaction timing. Use an existing analytics tool/framework rather than building one from scratch. Goal in this early phase is understanding real usage patterns (visits, waiting times, feature adoption) well enough to prioritize future work | 2–3h | Not started |

---

**Total estimate: roughly 45–60 hours of Claude-Code-assisted work** for everything above. If P2 items slip to v0.1.1, the P0/P1-only core drops to roughly **38–50 hours**.

Not included here (tracked in `mi-agenda-api`'s design.md §24 as post-MVP): payments, WhatsApp booking, native apps, multi-location, advanced analytics/reporting, loyalty/promotions, calendar integrations, waitlists, recurring appointments, subscriptions, invoicing, marketplace. Basic per-employee/business revenue totals are in scope — see Phase 7.

## Phase 8 — Admin dashboard redesign (calendar-first UX)

Speculative, deferred: not part of the current MVP estimate above, not started, not scoped in detail yet. Raised because the current admin dashboard is a multi-page nav (business, employees, services, schedules, availability, appointments, customers) built for completeness rather than speed of use, and for the people actually running a business day to day, quick reading and quick action matter more than visual polish.

The idea: replace the multi-page dashboard with a single calendar-first screen, modeled on Google Calendar's day-to-day UX rather than the current settings-style nav.

- One page, one weekly calendar as the default view (not a separate "Appointments" tab among many)
- Peripheral action buttons around the calendar's edges open modals for the less-frequent stuff currently spread across separate pages (business settings, employees, services, schedules, availability blocks)
- Clicking an empty time block (e.g. 8:00–9:00) opens a quick popup to act on that slot directly — e.g. block it off (time off / unavailability) — instead of navigating to the Availability page and typing exact timestamps
- Clicking an existing appointment opens a quick popup with its key actions inline (cancel, mark missed/completed, send a message, etc.) instead of navigating to a separate appointment detail page
- Would likely fold in the already-Done "Quick time-off from calendar" idea above (P1, currently Skipped) rather than needing it solved separately

Needs real UX design and scoping before implementation: which actions belong in the calendar's quick popups versus a modal, how this interacts with the existing per-role/permission scoping (admin vs employee, `edit_appointment_status` etc.), and whether the current page-based routes are removed outright or kept as a fallback.

## Phase 9 — Walk-in appointments

A quick way for an employee or admin to add an appointment for a customer who walks in without one already booked, so they can be served right away without the usual customer-initiated booking flow. Creates a real appointment row like any other (employee, service, start/end time, price), so it's indistinguishable from a booked one in history, revenue totals, and the employee's schedule. No phone verification is required, since staff are physically vouching for the customer.

| Priority | Task | Description | ETA | Progress |
|---|---|---|---|---|
| P1 | "Add walk-in" dialog on the calendar | A button on the appointments calendar/list toolbar opens a form (employee picker for an admin, service, start time, customer name and phone) that books via `POST /appointments/walk-in`, then refreshes the active view | 2h | Done |
| P2 | Optional phone on a walk-in customer | The walk-in dialog's phone field is no longer required; a customer's phone is now shown throughout the admin (appointment detail, customer list/detail) only when one is on file, and the "message on WhatsApp" action is hidden without one | 1h | Done |
| P1 | Fix walk-in bookings always rejected, replace free-typed time with a day + slot picker | The dialog's `datetime-local` field, combined with `new Date(value).toISOString()`, converted the typed time using the browser's own timezone rather than the business's, so any offset mismatch silently targeted the wrong instant and `POST /appointments/walk-in` rejected it as outside working hours regardless of what staff picked. Replaced with the same two-step flow the public booking page uses: a date field, then a list of that employee/service's actual open slots (`GET /availability`) to click — `start_time` is now taken verbatim from a slot the server already computed in the business's own timezone, never reconstructed client-side | 2h | Done |
| P2 | Phone-first walk-in form with name auto-fill | The phone field now comes before the name field, and once it looks complete a debounced `GET /customers/lookup` call fills the name in from a matching existing customer, the same convenience the public booking form already gives customers — never overwriting a name staff already typed | 1h | Done |
| P2 | Hide cancelled appointments on the calendar view | A "Hide cancelled" checkbox on the week/day calendar toolbar, checked (hidden) by default; state lives in the URL (`cancelled=show` when unchecked) the same way the other calendar filters do. Only affects the calendar view — the list view already has its own status filter | 30m | Done |

## Phase 10 — Expanded employee permissions

Depends on `mi-agenda-api`'s own Phase 8 (new `manage_schedule`, `manage_availability`, `manage_services` permissions) landing first. Extends the existing permission model (an employee already reaches `Customers` once granted `view_customers`) to the remaining admin-only pages, so a granted employee can run more of their own day-to-day without needing an admin for every change.

- `admin-nav.tsx`'s `Schedules`, `Availability`, and `Services` items lose their hardcoded `adminOnly: true` and instead check the matching new permission, the same way `Customers` already checks `view_customers`
- The Schedules and Availability pages need their own per-page scoping once an employee (not just an admin) can reach them: a permitted employee should only ever see and edit their own schedule/availability blocks, never another employee's, matching how the backend itself scopes those permissions to the caller's own `employee_id`
- Services has no natural per-employee scoping (it's a shared, business-wide catalog) — pending the API-side scoping decision noted in that repo's own Phase 8, a permitted employee likely sees the full catalog like an admin does today, not a filtered subset

## Phase 11 — Action history (audit log)

Admin-only visibility into who changed what and when across the business (appointments, services, employees, schedules, customers, business settings, etc.). Depends on `mi-agenda-api`'s own audit log phase landing first.

| Priority | Task | Description | ETA | Progress |
|---|---|---|---|---|
| P1 | Admin "Action history" page | New admin-only page listing the business's audit trail from `GET /audit-logs`: actor, action, affected record, and timestamp, with basic filters (entity type, date range) | 2–3h | Not started |
| P2 | Nav entry for action history | New `admin-nav.tsx` item, visible to the `admin` role only | 30m | Not started |
