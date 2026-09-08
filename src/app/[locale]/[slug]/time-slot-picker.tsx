"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "@/i18n/navigation";
import type { AvailabilitySlot } from "@/lib/api/availability";
import { formatTime } from "@/lib/format";
import { toIntlLocale } from "./calendar";
import { stepUrl } from "./step-url";

/**
 * One row per available slot, confirmed via a dialog before navigating to
 * the next step — a plain link here was too easy to tap by accident on a
 * phone screen full of closely packed time options.
 */
export function TimeSlotPicker({
  slug,
  serviceId,
  employeeId,
  date,
  timezone,
  slots,
}: {
  slug: string;
  serviceId: string;
  employeeId: string;
  date: string;
  timezone: string;
  slots: AvailabilitySlot[];
}) {
  const t = useTranslations("Booking");
  const tc = useTranslations("Common");
  const locale = toIntlLocale(useLocale());
  const router = useRouter();
  const [pendingSlot, setPendingSlot] = useState<AvailabilitySlot | null>(
    null,
  );

  function confirmSlot() {
    if (!pendingSlot) return;
    router.push(
      stepUrl(slug, {
        service: serviceId,
        employee: employeeId,
        date,
        time: pendingSlot.start_time,
      }),
    );
  }

  return (
    <>
      <div className="divide-border flex flex-col divide-y overflow-hidden rounded-lg border">
        {slots.map((slot) => (
          <button
            key={slot.start_time}
            type="button"
            onClick={() => setPendingSlot(slot)}
            className="hover:bg-accent focus-visible:bg-accent px-4 py-3 text-left text-sm font-medium transition-colors outline-none"
          >
            {formatTime(slot.start_time, timezone, locale)}
          </button>
        ))}
      </div>

      <Dialog
        open={pendingSlot !== null}
        onOpenChange={(open) => {
          if (!open) setPendingSlot(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {pendingSlot &&
                t("confirmTimeTitle", {
                  time: formatTime(pendingSlot.start_time, timezone, locale),
                })}
            </DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPendingSlot(null)}
            >
              {tc("cancel")}
            </Button>
            <Button type="button" size="sm" onClick={confirmSlot}>
              {t("confirmTimeButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
