export interface StepUrlParams {
  service?: string;
  employee?: string;
  date?: string;
  month?: string;
  time?: string;
  notice?: string;
}

/** Builds `/{slug}` with only the given, defined query params, in a stable order. */
export function stepUrl(slug: string, params: StepUrlParams): string {
  const qs = new URLSearchParams();
  if (params.service) qs.set("service", params.service);
  if (params.employee) qs.set("employee", params.employee);
  if (params.date) qs.set("date", params.date);
  if (params.month) qs.set("month", params.month);
  if (params.time) qs.set("time", params.time);
  if (params.notice) qs.set("notice", params.notice);
  const query = qs.toString();
  return `/${slug}${query ? `?${query}` : ""}`;
}
