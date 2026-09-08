"use client";

import { useTranslations } from "next-intl";
import {
  forwardRef,
  type KeyboardEvent,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import {
  confirmPhoneVerification,
  sendPhoneVerification,
} from "@/lib/api/phone-verification";

type Status = "sending" | "sent" | "confirming" | "error";

/** How long after a send before "Resend code" becomes clickable again. */
const RESEND_COOLDOWN_SECONDS = 30;

export interface PhoneVerificationHandle {
  /** Opens the dialog and sends a fresh code, in one action. */
  open: () => void;
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Mandatory WhatsApp phone verification, opened by the parent (the booking
 * form's own "Confirmar reserva" button) rather than a trigger of its own —
 * see mi-agenda-api's POST /appointments, which now rejects a booking
 * without one. Re-verified every time: `key={phone}` from the parent
 * remounts this component whenever the phone number changes, so there's no
 * way to carry a stale "verified" state over to a different number.
 */
export const PhoneVerification = forwardRef<
  PhoneVerificationHandle,
  {
    businessSlug: string;
    phone: string;
    /** Shown in the dialog text — the number as the customer typed it, without the country code prepended for the actual API calls. */
    displayPhone: string;
    onVerified: () => void;
  }
>(function PhoneVerification(
  { businessSlug, phone, displayPhone, onVerified },
  ref,
) {
  const t = useTranslations("PhoneVerification");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("sending");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Both timestamps, not durations, so the countdowns stay accurate even if
  // the tab is backgrounded for a while rather than drifting from missed
  // ticks.
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "sent" && status !== "confirming") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [status]);

  const remainingSeconds = expiresAt
    ? Math.max(0, Math.ceil((expiresAt - now) / 1000))
    : 0;
  const resendRemainingSeconds = resendAvailableAt
    ? Math.max(0, Math.ceil((resendAvailableAt - now) / 1000))
    : 0;
  const codeExpired =
    (status === "sent" || status === "confirming") &&
    expiresAt !== null &&
    remainingSeconds <= 0;

  async function sendCode() {
    setStatus("sending");
    setError(null);
    try {
      const result = await sendPhoneVerification({ businessSlug, phone });
      // Only ever set outside production, as a stand-in for real delivery
      // until an authentication-category WhatsApp template is approved.
      setCode(result.code ?? "");
      setDevCode(Boolean(result.code));
      setExpiresAt(new Date(result.expires_at).getTime());
      setResendAvailableAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
      setNow(Date.now());
      setStatus("sent");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("sendError"));
      setStatus("error");
    }
  }

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      sendCode();
    },
  }));

  async function handleConfirm() {
    if (!code.trim() || status === "confirming" || codeExpired) return;
    setStatus("confirming");
    setError(null);
    try {
      await confirmPhoneVerification({ businessSlug, phone, code });
      setOpen(false);
      onVerified();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("confirmError"));
      setStatus("sent");
    }
  }

  function handleCodeKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleConfirm();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("dialogDescription", { phone: displayPhone })}
          </DialogDescription>
        </DialogHeader>

        {status === "sending" ? (
          <div className="flex items-center justify-center p-6">
            <Spinner className="size-6" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t("codePlaceholder")}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={handleCodeKeyDown}
              autoFocus
            />
            {devCode && (
              <p className="text-muted-foreground text-xs">
                {t("devCodeHint")}
              </p>
            )}
            {error && <p className="text-destructive text-xs">{error}</p>}
            {status !== "error" &&
              (resendRemainingSeconds > 0 ? (
                <p className="text-muted-foreground text-xs">
                  {t("resendIn", {
                    time: formatCountdown(resendRemainingSeconds),
                  })}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={sendCode}
                  className="text-primary self-start text-xs underline"
                >
                  {t("resendCode")}
                </button>
              ))}
          </div>
        )}

        <DialogFooter>
          {status === "error" ? (
            <Button type="button" size="sm" onClick={sendCode}>
              {t("retrySend")}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={
                status === "sending" ||
                status === "confirming" ||
                !code.trim() ||
                codeExpired
              }
            >
              {status === "confirming" && <Spinner />}
              {t("confirmCode")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
