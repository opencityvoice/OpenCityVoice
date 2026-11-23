import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Brand } from "@/components/brand";
import { getCurrentUser } from "@/lib/data";
import { demoLoginEmail, demoLoginPassword, oauthProviders, passwordLoginEnabled, safeNext } from "@/lib/config";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("title") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  if (await getCurrentUser()) redirect(next);
  const t = await getTranslations("auth");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <Brand className="mb-10 justify-center text-lg" />
        <h1 className="text-center text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">{t("subtitle")}</p>
        <LoginForm
          next={next}
          providers={oauthProviders}
          passwordLogin={passwordLoginEnabled}
          demoLogin={demoLoginEmail && demoLoginPassword ? { email: demoLoginEmail, password: demoLoginPassword } : null}
          initialError={params.error ? t("authError") : null}
        />
        <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
          {t.rich("terms", {
            terms: (chunks) => (
              <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </main>
  );
}
