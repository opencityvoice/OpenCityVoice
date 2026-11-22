"use client";

import { useLocale, useNow } from "next-intl";
import { formatDistanceStrict } from "date-fns";
import { enUS, sl } from "date-fns/locale";
import { CategoryIcon } from "@/components/category-icon";
import { localized } from "@/i18n/config";
import { cn } from "@/lib/utils";

const dateLocales = { en: enUS, sl } as const;

export function useDateLocale() {
  const locale = useLocale() as keyof typeof dateLocales;
  return dateLocales[locale] ?? enUS;
}

export function TimeAgo({ date, className }: { date: string; className?: string }) {
  const locale = useDateLocale();
  const now = useNow({ updateInterval: 60_000 });
  const value = new Date(date);
  return (
    <time dateTime={date} title={value.toLocaleString()} className={className} suppressHydrationWarning>
      {formatDistanceStrict(value, now, { addSuffix: true, locale })}
    </time>
  );
}

export function StatusBadge({ name, color, className }: { name: unknown; color: string; className?: string }) {
  const locale = useLocale();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
      style={{ borderColor: `color-mix(in oklch, ${color} 35%, transparent)`, backgroundColor: `color-mix(in oklch, ${color} 10%, white)`, color: `color-mix(in oklch, ${color} 75%, black)` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {localized(name, locale)}
    </span>
  );
}

export function CategoryLabel({
  name,
  icon,
  color,
  className,
}: {
  name: unknown;
  icon: string;
  color: string;
  className?: string;
}) {
  const locale = useLocale();
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span className="flex size-5 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: color }}>
        <CategoryIcon name={icon} className="size-3 text-white" />
      </span>
      <span className="truncate">{localized(name, locale)}</span>
    </span>
  );
}
