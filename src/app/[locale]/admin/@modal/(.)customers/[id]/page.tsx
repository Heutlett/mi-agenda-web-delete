"use client";

import { CustomerDetailContent } from "@/app/[locale]/admin/customers/[id]/customer-detail";

/** Intercepts an in-app navigation to /admin/customers/{id}, showing it as a modal over whatever admin page is currently open instead of a full-page navigation. */
export default function CustomerModal() {
  return <CustomerDetailContent asModal={true} />;
}
