"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { forgotPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

export default function ForgotPasswordPage() {
  const t = useTranslations("Auth");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim()) {
      setError(t("emailRequired"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await forgotPassword(email.trim());
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
      setSubmitting(false);
    }
  }

  if (message) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6 text-center">
        <h1 className="text-lg font-semibold">{t("forgotPasswordTitle")}</h1>
        <p className="text-muted-foreground text-sm">{message}</p>
        <Link href="/admin/login" className="text-sm underline">
          {t("backToSignIn")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <div className="space-y-1 text-center">
        <h1 className="text-lg font-semibold">{t("forgotPasswordTitle")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("forgotPasswordBody")}
        </p>
      </div>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="forgot-email" className="text-sm font-medium">
            {t("email")}
          </label>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" disabled={submitting}>
          {submitting && <Spinner />}
          {submitting ? t("sending") : t("sendResetLink")}
        </Button>
      </form>
      <Link href="/admin/login" className="text-center text-sm underline">
        {t("backToSignIn")}
      </Link>
    </div>
  );
}
