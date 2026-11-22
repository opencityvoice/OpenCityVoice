"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Bell, CheckCheck, MessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge, TimeAgo } from "@/components/report-bits";
import { localized } from "@/i18n/config";
import type { UserNotification } from "@/lib/user-notifications";

export function NotificationBell() {
  const t = useTranslations("alerts");
  const locale = useLocale();
  const [items, setItems] = useState<UserNotification[] | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) setItems(((await res.json()) as { items: UserNotification[] }).items ?? []);
    } catch {
      // Keep the last known list when the request fails.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!cancelled && res.ok) {
          setItems(((await res.json()) as { items: UserNotification[] }).items ?? []);
        }
      } catch {
        // Keep the last known list when the request fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const markRead = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    setItems((prev) =>
      prev?.map((item) => (ids.includes(item.id) ? { ...item, read: true } : item)) ?? prev,
    );
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    } catch {
      // Read state will catch up on the next load.
    }
  }, []);

  const unread = items?.filter((item) => !item.read).length ?? 0;

  return (
    <DropdownMenu open={open} onOpenChange={(value) => {
      setOpen(value);
      if (value) void load();
    }}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={t("title")} className="relative" />
        }
      >
        <Bell />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("title")}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {unread > 0 && (
          <DropdownMenuItem onClick={() => void markRead(items?.filter((i) => !i.read).map((i) => i.id) ?? [])}>
            <CheckCheck className="size-4" />
            {t("markAllRead")}
          </DropdownMenuItem>
        )}
        {items === null ? (
          <div className="px-3 py-4 text-sm text-muted-foreground">{t("loading")}</div>
        ) : items.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">{t("empty")}</div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                render={<Link href={`/${item.municipalitySlug}/reports/${item.reportNumber}`} />}
                onClick={() => void markRead([item.id])}
                className="items-start gap-3 py-2.5"
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  {item.kind === "comment" ? (
                    <MessageSquare className="size-4 text-muted-foreground" />
                  ) : (
                    <RefreshCw className="size-4 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${item.read ? "font-medium" : "font-semibold"}`}>
                    {item.kind === "comment"
                      ? t("comment", { name: item.authorName ?? t("someone") })
                      : item.statusName
                        ? t("statusChanged", { status: localized(item.statusName, locale) })
                        : t("statusChangedGeneric")}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="truncate">
                      #{item.reportNumber} · {item.reportTitle}
                    </span>
                  </span>
                  {item.kind === "comment" && item.body && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.body}</span>
                  )}
                  {item.kind === "status" && item.statusName != null && item.statusColor != null && (
                    <StatusBadge name={item.statusName} color={item.statusColor} className="mt-1" />
                  )}
                  <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <TimeAgo date={item.createdAt} />
                    {item.municipalityName && <span className="truncate">· {item.municipalityName}</span>}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile" />}>
          {t("settings")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
