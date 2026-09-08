import { apiFetch } from "./client";

export interface AvailabilitySlot {
  start_time: string;
  end_time: string;
}

export interface AvailabilityResponse {
  date: string;
  employee_id: string;
  service_id: string;
  duration_minutes: number;
  slots: AvailabilitySlot[];
}

/** GET /availability — open slots for one business/employee/service/date. */
export function getAvailability(params: {
  businessSlug: string;
  employeeId: string;
  serviceId: string;
  date: string;
}): Promise<AvailabilityResponse> {
  return apiFetch<AvailabilityResponse>("/availability", {
    params: {
      business_slug: params.businessSlug,
      employee_id: params.employeeId,
      service_id: params.serviceId,
      date: params.date,
    },
  });
}
