import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { unsubscribeFromReport } from "@/app/actions/profile";
import { ProfileForm } from "./profile-form";

export async function generateMetadata() {
  const t = await getTranslations("profile");
  return { title: t("title") };
}

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const t = await getTranslations("profile");
  const supabase = await createClient();
  const [{ data: reports }, { data: memberships }, { data: subscriptions }] = await Promise.all([
    supabase
      .from("reports")
      .select("id, number, title, description, created_at, municipalities(slug, name), statuses(name, color)")
      .eq("author_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("municipality_members").select("status, role, municipalities(slug, name)").eq("user_id", user.id),
    supabase
      .from("report_subscriptions")
      .select("report_id, reports(number, title, description, municipalities(slug, name))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);
  const followedReports = (subscriptions ?? [])
    .map((s) => ({ reportId: s.report_id, report: s.reports }))
    .filter((s) => s.report?.municipalities);
  // Reports and memberships in deactivated municipalities have no visible municipality.
  const visibleReports = (reports ?? []).filter((r) => r.municipalities);
  const visibleMemberships = (memberships ?? []).filter((m) => m.municipalities);

  return (
    <>
      <SiteHeader next="/profile" />
      <main className="mx-auto w-full max-w-2xl space-y-10 px-4 py-8">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <ProfileForm
          email={user.email}
          fullName={user.profile.full_name ?? ""}
          emailNotifications={user.profile.email_notifications}
        />

        <section>
          <h2 className="text-sm font-semibold">{t("commentNotifications")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("commentNotificationsText")}</p>
          <ul className="mt-3 divide-y rounded-xl border">
            {followedReports.map(({ reportId, report }) => (
              <li key={reportId} className="flex items-center gap-3 p-3 text-sm">
                <Link
                  href={`/${report!.municipalities!.slug}/reports/${report!.number}`}
                  className="min-w-0 flex-1"
                >
                  <span className="block truncate font-medium">{report!.title || report!.description}</span>
                  <span className="text-xs text-muted-foreground">
                    {report!.municipalities!.name} · #{report!.number}
                  </span>
                </Link>
                <form action={unsubscribeFromReport.bind(null, reportId)}>
                  <button type="submit" className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
                    {t("unsubscribeReport")}
                  </button>
                </form>
              </li>
            ))}
            {!followedReports.length && (
              <li className="p-4 text-sm text-muted-foreground">{t("noSubscriptions")}</li>
            )}
          </ul>
        </section>

        {(visibleMemberships.length > 0 || user.profile.is_platform_admin) && (
          <section>
            <h2 className="text-sm font-semibold">{t("memberships")}</h2>
            <ul className="mt-3 divide-y rounded-xl border">
              {user.profile.is_platform_admin && (
                <li>
                  <Link href="/admin" className="flex items-center gap-3 p-3 text-sm hover:bg-muted/60">
                    <span className="flex-1 font-medium">{t("platformAdmin")}</span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              )}
              {visibleMemberships.map((m) => (
                <li key={m.municipalities!.slug}>
                  <Link
                    href={m.status === "approved" ? `/${m.municipalities!.slug}/manage` : `/${m.municipalities!.slug}/join`}
                    className="flex items-center gap-3 p-3 text-sm hover:bg-muted/60"
                  >
                    <span className="flex-1 font-medium">{m.municipalities!.name}</span>
                    <span className="text-xs text-muted-foreground">{t(m.status)}</span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold">{t("myReports")}</h2>
          <ul className="mt-3 divide-y rounded-xl border">
            {visibleReports.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/${r.municipalities!.slug}/reports/${r.number}`}
                  className="flex items-center gap-3 p-3 text-sm hover:bg-muted/60"
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: r.statuses?.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.title || r.description}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.municipalities!.name} · #{r.number}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
            {!visibleReports.length && <li className="p-4 text-sm text-muted-foreground">{t("noReports")}</li>}
          </ul>
        </section>
      </main>
    </>
  );
}
