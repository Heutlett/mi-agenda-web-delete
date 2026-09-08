import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { Spinner } from "@/components/ui/spinner";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  const t = useTranslations("Auth");
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <h1 className="text-center text-lg font-semibold">
        {t("resetPasswordTitle")}
      </h1>
      <Suspense
        fallback={
          <div className="flex justify-center p-6">
            <Spinner className="size-6" />
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
