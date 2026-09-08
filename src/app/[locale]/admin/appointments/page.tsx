import { Suspense } from "react";

import { Spinner } from "@/components/ui/spinner";
import { AppointmentsView } from "./appointments-view";

export default function AppointmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-6">
          <Spinner className="size-6" />
        </div>
      }
    >
      <AppointmentsView />
    </Suspense>
  );
}
