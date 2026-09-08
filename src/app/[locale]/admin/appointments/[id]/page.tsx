"use client";

import { AppointmentDetailContent } from "./appointment-detail";

/** Direct URL / hard refresh fallback for an intercepted appointment (see admin/@modal). */
export default function AppointmentDetailPage() {
  return <AppointmentDetailContent asModal={false} />;
}
