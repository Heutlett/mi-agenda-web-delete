"use client";

import { AppointmentDetailContent } from "@/app/[locale]/admin/appointments/[id]/appointment-detail";

/** Intercepts an in-app navigation to /admin/appointments/{id}, showing it as a modal over whatever admin page is currently open instead of a full-page navigation. */
export default function AppointmentModal() {
  return <AppointmentDetailContent asModal={true} />;
}
