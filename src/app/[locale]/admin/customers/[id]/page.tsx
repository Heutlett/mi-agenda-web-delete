"use client";

import { CustomerDetailContent } from "./customer-detail";

/** Direct URL / hard refresh fallback for an intercepted customer (see admin/@modal). */
export default function CustomerDetailPage() {
  return <CustomerDetailContent asModal={false} />;
}
