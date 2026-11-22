import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { getAccess, getMunicipality } from "@/lib/data";
import { ManageNav } from "./manage-nav";

export default async function ManageLayout({ children, params }: LayoutProps<"/[municipality]/manage">) {
  const { municipality: slug } = await params;
  const municipality = await getMunicipality(slug);
  const access = await getAccess(municipality.id);
  if (!access.user) redirect(`/login?next=/${slug}/manage`);
  if (!access.isStaff) redirect(`/${slug}/join`);
  const t = await getTranslations("manage");

  const links = [
    { href: `/${slug}/manage`, label: t("dashboard") },
    { href: `/${slug}/manage/team`, label: t("team") },
    { href: `/${slug}/manage/notifications`, label: t("notifications") },
    { href: `/${slug}/manage/moderation`, label: t("moderation") },
    ...(access.isAdmin ? [{ href: `/${slug}/manage/settings`, label: t("settings") }] : []),
  ];

  return (
    <div className="flex h-dvh flex-col" style={{ "--primary": municipality.primary_color } as React.CSSProperties}>
      <SiteHeader municipality={municipality} next={`/${slug}/manage`} className="static" />
      <ManageNav links={links} />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
