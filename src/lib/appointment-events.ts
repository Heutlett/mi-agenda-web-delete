/**
 * A tiny cross-component signal for one specific gap: the appointment
 * detail view opens as a modal intercepting whatever list page is open
 * underneath (the calendar, a customer's history, the global history page)
 * — a sibling route segment in the same layout, with no direct prop
 * channel back to it. Editing an appointment there (cancelling it, most
 * visibly) updates the modal's own state, but the list underneath has no
 * way to know and keeps showing stale data until a manual reload. Every
 * list view that renders appointments subscribes here and refetches when
 * this fires, rather than each reaching into the others' state.
 */
const EVENT_NAME = "mi-agenda:appointment-changed";

/** Call after any successful appointment update (status, price, payment_status). */
export function notifyAppointmentChanged(): void {
  window.dispatchEvent(new Event(EVENT_NAME));
}

/** Subscribes handler to notifyAppointmentChanged() for as long as the caller keeps the returned cleanup around — call it from a useEffect's own cleanup. */
export function onAppointmentChanged(handler: () => void): () => void {
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
