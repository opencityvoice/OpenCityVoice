"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProviderIcon } from "@/components/provider-icons";
import { createClient } from "@/lib/supabase/client";
import { providerLabels, type OAuthProvider } from "@/lib/config";

type DemoCreds = { email: string; password: string };

type Props = {
  next: string;
  providers: OAuthProvider[];
  passwordLogin: boolean;
  demoLogin: DemoCreds | null;
  demoStaffLogin: DemoCreds | null;
  initialError: string | null;
};

export function LoginForm({ next, providers, passwordLogin, demoLogin, demoStaffLogin, initialError }: Props) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError);

  const supabase = createClient();
  const callbackUrl = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function signInWithProvider(provider: OAuthProvider) {
    setBusy(provider);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl(), scopes: provider === "azure" ? "email" : undefined },
    });
    if (error) {
      setError(t("authError"));
      setBusy(null);
    }
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl(), shouldCreateUser: true },
    });
    setBusy(null);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function signInWithPassword() {
    setBusy("password");
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(t("invalidCredentials"));
      setBusy(null);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy("code");
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
    if (error) {
      setError(t("invalidCode"));
      setBusy(null);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  if (sent) {
    return (
      <div className="mt-8 rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="font-medium">{t("checkEmail")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("checkEmailText", { email })}</p>
          </div>
        </div>
        <form onSubmit={verifyCode} className="mt-5 space-y-3">
          <Label htmlFor="code">{t("code")}</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="h-11 text-center font-mono text-lg tracking-[0.4em]"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="h-11 w-full" disabled={code.length !== 6 || busy !== null}>
            {busy === "code" && <Loader2 className="animate-spin" />}
            {t("verifyCode")}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setSent(false)}>
            {t("useDifferentEmail")}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {providers.length > 0 && (
        <>
          <div className="grid gap-2">
            {providers.map((provider) => (
              <Button
                key={provider}
                variant="outline"
                className="h-11 w-full justify-center gap-3 text-[0.95rem]"
                onClick={() => signInWithProvider(provider)}
                disabled={busy !== null}
              >
                {busy === provider ? <Loader2 className="animate-spin" /> : <ProviderIcon provider={provider} />}
                {t("continueWith", { provider: providerLabels[provider] })}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("or")}
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      {passwordLogin && (demoLogin || demoStaffLogin) && (
        <div className="rounded-xl border border-dashed bg-muted/40 p-3 text-sm">
          <p className="font-medium">{t("demoHint")}</p>
          <ul className="mt-1.5 space-y-1.5">
            {[
              { label: t("demoCitizen"), creds: demoLogin },
              { label: t("demoStaff"), creds: demoStaffLogin },
            ]
              .filter((entry): entry is { label: string; creds: DemoCreds } => entry.creds !== null)
              .map(({ label, creds }) => (
                <li key={label} className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-xs text-muted-foreground">
                    {label}: <span className="font-mono">{creds.email} / {creds.password}</span>
                  </p>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-medium text-primary underline underline-offset-2"
                    onClick={() => {
                      setEmail(creds.email);
                      setPassword(creds.password);
                    }}
                  >
                    {t("demoFill")}
                  </button>
                </li>
              ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">{t("demoReset")}</p>
        </div>
      )}

      <form onSubmit={sendLink} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
        </div>
        {passwordLogin && (
          <div className="space-y-2">
            <Label htmlFor="password">
              {t("password")} <span className="font-normal text-muted-foreground">(demo)</span>
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
            />
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {passwordLogin && password ? (
          <Button type="button" className="h-11 w-full" disabled={busy !== null || !email} onClick={signInWithPassword}>
            {busy === "password" && <Loader2 className="animate-spin" />}
            {t("signInWithPassword")}
          </Button>
        ) : (
          <Button type="submit" className="h-11 w-full" disabled={busy !== null}>
            {busy === "email" && <Loader2 className="animate-spin" />}
            {t("sendLink")}
          </Button>
        )}
      </form>
    </div>
  );
}
