"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { resetPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

export function ResetPasswordForm() {
  const t = useTranslations("Auth");
  const token = useSearchParams().get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <p className="text-muted-foreground text-center text-sm">
        {t.rich("missingTokenBody", {
          link: (chunks) => (
            <Link href="/admin/forgot-password" className="underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("passwordsDontMatch"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // Safe: the early return above guarantees a token by this point, but
      // TypeScript doesn't narrow through the closure captured here.
      await resetPassword(token as string, password);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? t("invalidResetLink")
          : err instanceof ApiError
            ? err.message
            : t("genericError"),
      );
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-2 text-center text-sm">
        <p className="font-medium">{t("passwordUpdatedTitle")}</p>
        <p className="text-muted-foreground">
          {t.rich("passwordUpdatedBody", {
            link: (chunks) => (
              <Link href="/admin/login" className="underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="reset-password" className="text-sm font-medium">
          {t("newPassword")}
        </label>
        <Input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="reset-password-confirm" className="text-sm font-medium">
          {t("confirmPassword")}
        </label>
        <Input
          id="reset-password-confirm"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting && <Spinner />}
        {submitting ? t("updating") : t("updatePassword")}
      </Button>
    </form>
  );
}
