import Link from "next/link";
import { Brand } from "@/components/brand";
import { UserMenu } from "@/components/user-menu";
import { NotificationBell } from "@/components/notification-bell";
import { findMunicipality, getCurrentUser } from "@/lib/data";
import { singleMunicipality } from "@/lib/config";
import { cn } from "@/lib/utils";
import { MunicipalityLogo } from "@/components/municipality-logo";

type Props = {
  municipality?: { slug: string; name: string; logo_path?: string | null; primary_color?: string | null } | null;
  next?: string;
  className?: string;
};

export async function SiteHeader({ municipality: municipalityProp, next, className }: Props) {
  const municipality = municipalityProp ?? (singleMunicipality ? await findMunicipality(singleMunicipality) : null);
  const user = await getCurrentUser();
  return (
    <header className={cn("sticky top-0 z-30 border-b bg-background/95 backdrop-blur", className)}>
      <div className="flex h-14 items-center gap-3 px-4">
        {singleMunicipality && municipality ? (
          <Link href={`/${municipality.slug}`} className="flex min-w-0 items-center gap-2 font-semibold tracking-tight">
            <MunicipalityLogo name={municipality.name} logoPath={municipality.logo_path} color={municipality.primary_color} />
            <span className="truncate">{municipality.name}</span>
          </Link>
        ) : (
          <>
            <Brand className="shrink-0" />
            {municipality && (
              <>
                <span className="text-border" aria-hidden="true">/</span>
                <Link href={`/${municipality.slug}`} className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <MunicipalityLogo name={municipality.name} logoPath={municipality.logo_path} color={municipality.primary_color} className="size-6" />
                  <span className="truncate">{municipality.name}</span>
                </Link>
              </>
            )}
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          {user && <NotificationBell />}
          <UserMenu
            next={next}
            user={
              user
                ? {
                    name: user.profile.full_name,
                    email: user.email,
                    avatarUrl: user.profile.avatar_url,
                    isPlatformAdmin: user.profile.is_platform_admin,
                  }
                : null
            }
          />
        </div>
      </div>
    </header>
  );
}
