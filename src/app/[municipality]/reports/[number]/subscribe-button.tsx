"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setReportSubscription } from "@/app/actions/reports";
import { cn } from "@/lib/utils";

type Props = { reportId: string; subscribed: boolean; signedIn: boolean; path: string };

export function SubscribeButton({ reportId, subscribed, signedIn, path }: Props) {
  const t = useTranslations("report");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setOptimistic] = useOptimistic(subscribed);

  function onClick() {
    if (!signedIn) return router.push(`/login?next=${encodeURIComponent(path)}`);
    const next = !state;
    startTransition(async () => {
      setOptimistic(next);
      const result = await setReportSubscription(reportId, next, path);
      if (!result.ok) {
        setOptimistic(state);
        toast.error(tc("error"));
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={pending}
      aria-pressed={state}
      aria-label={state ? t("subscribed") : t("subscribe")}
      title={state ? t("subscribed") : t("subscribe")}
      className={cn("size-8", state ? "text-primary" : "text-muted-foreground")}
    >
      {state ? <Bell className="size-4 fill-current" /> : <BellOff className="size-4" />}
    </Button>
  );
}
