"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { toggleVote } from "@/app/actions/reports";
import { cn } from "@/lib/utils";

type Props = {
  reportId: string;
  count: number;
  voted: boolean;
  signedIn: boolean;
  /** Current page path; used for login redirect and revalidation. */
  path: string;
  className?: string;
};

/** Compact like button for report cards. Guests are sent to login first. */
export function VoteChip({ reportId, count, voted, signedIn, path, className }: Props) {
  const t = useTranslations("report");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setOptimistic] = useOptimistic({ count, voted });

  function onClick() {
    if (!signedIn) return router.push(`/login?next=${encodeURIComponent(path)}`);
    startTransition(async () => {
      setOptimistic({ count: state.count + (state.voted ? -1 : 1), voted: !state.voted });
      const result = await toggleVote(reportId, path);
      if (!result.ok) toast.error(tc("error"));
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={state.voted}
      aria-label={state.voted ? t("supported") : t("support")}
      title={state.voted ? t("supported") : t("support")}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-muted",
        state.voted ? "font-medium text-foreground" : "text-muted-foreground",
        pending && "opacity-60",
        className,
      )}
    >
      <ThumbsUp className={cn("size-3.5", state.voted && "fill-current")} />
      <span className="tabular-nums">{state.count}</span>
    </button>
  );
}
