import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { Spinner } from "@/components/ui/spinner";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  const t = useTranslations("Auth");
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <h1 className="text-center text-lg font-semibold">{t("loginTitle")}</h1>
      <Suspense
        fallback={
          <div className="flex justify-center p-6">
            <Spinner className="size-6" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
