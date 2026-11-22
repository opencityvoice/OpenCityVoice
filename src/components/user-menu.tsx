"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Globe, LogOut, Shield, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { localeNames, locales } from "@/i18n/config";
import { setLocale } from "@/app/actions/locale";

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

type Props = {
  user: { name: string | null; email: string | null; avatarUrl: string | null; isPlatformAdmin: boolean } | null;
  next?: string;
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Language" disabled={pending} />}>
        <Globe />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((l) => (
          <DropdownMenuItem key={l} onClick={() => startTransition(() => setLocale(l))}>
            {localeNames[l]}
            {l === locale && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserMenu({ user, next = "/" }: Props) {
  const t = useTranslations("common");
  const locale = useLocale();
  const [, startTransition] = useTransition();

  if (!user) {
    return (
      <div className="flex items-center gap-1">
        <LanguageSwitcher />
        <Button variant="outline" size="sm" render={<Link href={`/login?next=${encodeURIComponent(next)}`} />}
          nativeButton={false}>
          {t("signIn")}
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="rounded-full" aria-label={t("profile")} />}
      >
        <Avatar className="size-8">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
          <AvatarFallback className="text-xs">{initials(user.name ?? user.email)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate font-normal">
            <div className="truncate font-medium text-foreground">{user.name ?? t("profile")}</div>
            {user.email && <div className="truncate text-xs text-muted-foreground">{user.email}</div>}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile" />}>
          <User />
          {t("profile")}
        </DropdownMenuItem>
        {user.isPlatformAdmin && (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <Shield />
            Admin
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs">{t("language")}</DropdownMenuLabel>
          {locales.map((l) => (
            <DropdownMenuItem key={l} onClick={() => startTransition(() => setLocale(l))}>
              {localeNames[l]}
              {l === locale && <Check className="ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem nativeButton render={<button type="submit" form="sign-out" className="w-full" />}>
          <LogOut />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
      <form id="sign-out" action="/auth/signout" method="post" hidden />
    </DropdownMenu>
  );
}
