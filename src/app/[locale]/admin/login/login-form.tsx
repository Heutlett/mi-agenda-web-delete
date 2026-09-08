"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Link, useRouter } from "@/i18n/navigation";
import { login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { storeTokens } from "@/lib/auth/tokens";
import { safeNextPath } from "./safe-next-path";

export function LoginForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setError(t("emailPasswordRequired"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await login(email.trim(), password);
      storeTokens({
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
      });
      router.push(next);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? t("incorrectCredentials")
          : err instanceof ApiError
            ? err.message
            : t("genericError"),
      );
      setSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="login-email" className="text-sm font-medium">
            {t("email")}
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="login-password" className="text-sm font-medium">
            {t("password")}
          </label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" disabled={submitting}>
          {submitting && <Spinner />}
          {submitting ? t("signingIn") : t("signIn")}
        </Button>
      </form>
      <Link
        href="/admin/forgot-password"
        className="text-center text-sm underline"
      >
        {t("forgotPassword")}
      </Link>
    </>
  );
}
