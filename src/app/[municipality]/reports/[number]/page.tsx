import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Copy, EyeOff, MapPin } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ReportMap } from "@/components/map/report-map";
import { CategoryLabel, StatusBadge, TimeAgo } from "@/components/report-bits";
import { PhotoGallery } from "@/components/photo-gallery";
import { FlagButton } from "@/components/flag-button";
import { IndependentNotice, LegalLinks } from "@/components/legal-links";
import { getAccess, getCategories, getCurrentUser, getMunicipality, getStatuses } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { localized } from "@/i18n/config";
import { photoUrl, siteUrl } from "@/lib/config";
import { VoteButton } from "./vote-button";
import { Comments } from "./comments";
import { ShareButtons } from "./share-button";
import { HideReportButton } from "./hide-button";

type Params = PageProps<"/[municipality]/reports/[number]">;

async function loadReport(slug: string, numberParam: string) {
  const number = Number(numberParam);
  if (!Number.isInteger(number) || number < 1) notFound();
  const municipality = await getMunicipality(slug);
  const supabase = await createClient();
  const { data: report } = await supabase
    .from("reports")
    .select("*, author:profiles!reports_author_id_fkey(full_name)")
    .eq("municipality_id", municipality.id)
    .eq("number", number)
    .maybeSingle();
  if (!report) notFound();
  return { municipality, report, supabase };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { municipality: slug, number } = await params;
  const { report, municipality } = await loadReport(slug, number);
  const title = `${report.title || report.description.slice(0, 60)} · ${municipality.name}`;
  const description = report.description.slice(0, 160);
  const images = report.photos.slice(0, 1).map((path: string) => photoUrl(path));
  return {
    title,
    description,
    alternates: { canonical: `/${slug}/reports/${report.number}` },
    openGraph: { type: "article", title, description, images, siteName: "OpenCityVoice" },
    twitter: { card: images.length ? "summary_large_image" : "summary", title, description, images },
  };
}

export default async function ReportPage({ params }: Params) {
  const { municipality: slug, number } = await params;
  const { municipality, report, supabase } = await loadReport(slug, number);
  const t = await getTranslations("report");
  const tm = await getTranslations("moderation");
  const locale = await getLocale();
  const user = await getCurrentUser();

  const [categories, statuses, access, { data: events }, { data: comments }, { data: vote }] = await Promise.all([
    getCategories(municipality.id),
    getStatuses(municipality.id),
    getAccess(municipality.id),
    supabase
      .from("report_events")
      .select("id, type, note, created_at, to_status_id, assignee_id")
      .eq("report_id", report.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("report_comments")
      .select("id, body, photos, is_official, is_hidden, created_at, author_id, author:profiles(full_name, avatar_url)")
      .eq("report_id", report.id)
      .order("created_at"),
    user
      ? supabase.from("report_votes").select("report_id").eq("report_id", report.id).eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const { data: original } = report.duplicate_of
    ? await supabase.from("reports").select("number").eq("id", report.duplicate_of).maybeSingle()
    : { data: null };

  const category = categories.find((c) => c.id === report.category_id)!;
  const status = statuses.find((s) => s.id === report.status_id)!;
  const statusById = new Map(statuses.map((s) => [s.id, s]));
  const path = `/${slug}/reports/${report.number}`;
  const mapHref = `/${slug}?report=${report.id}`;
  const publicEvents = (events ?? []).filter((e) => e.type === "created" || e.type === "status_changed");

  return (
    <div style={{ "--primary": municipality.primary_color } as React.CSSProperties}>
      <SiteHeader municipality={municipality} isStaff={access.isStaff} next={path} />
      <main className="mx-auto max-w-5xl px-4 pt-4 pb-16 sm:pt-6">
        <Link
          href={mapHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {municipality.name}
        </Link>

        <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_340px]">
          <article className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge name={status.name} color={status.color} />
              <span className="text-xs text-muted-foreground">{t("number", { number: report.number })}</span>
            </div>
            {report.is_hidden && (
              <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <EyeOff className="mt-0.5 size-4 shrink-0" />
                {tm("hiddenNotice")}
              </p>
            )}
            {original && (
              <p className="mt-4 flex items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
                <Copy className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  {t.rich("duplicateOf", {
                    number: original.number,
                    link: (chunks) => (
                      <Link href={`/${slug}/reports/${original.number}`} className="font-medium underline underline-offset-4">
                        {chunks}
                      </Link>
                    ),
                  })}
                </span>
              </p>
            )}
            <h1 className="mt-3 text-2xl font-semibold text-balance sm:text-3xl">
              {report.title || localized(category.name, locale)}
            </h1>
            <CategoryLabel name={category.name} icon={category.icon} color={category.color} className="mt-3 text-sm" />
            <p className="mt-2 text-sm text-muted-foreground">
              {t("reportedBy", { name: report.author?.full_name || t("anonymous") })} · <TimeAgo date={report.created_at} />
            </p>

            {report.photos.length > 0 && <PhotoGallery paths={report.photos} className="mt-6" />}

            <p className="mt-6 leading-relaxed whitespace-pre-line">{report.description}</p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {!original && (
                <VoteButton
                  reportId={report.id}
                  count={report.vote_count}
                  voted={Boolean(vote)}
                  signedIn={Boolean(user)}
                  path={path}
                />
              )}
              <div className="ml-auto">
                {access.isStaff ? (
                  <HideReportButton reportId={report.id} hidden={report.is_hidden} />
                ) : (
                  user && user.id !== report.author_id && <FlagButton reportId={report.id} />
                )}
              </div>
            </div>

            <section className="mt-6 rounded-xl border bg-muted/30 p-4">
              <h2 className="text-sm font-semibold">{t("shareTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("shareText")}</p>
              <ShareButtons
                className="mt-3"
                url={`${siteUrl}${path}`}
                text={t("shareMessage", { title: report.title || report.description.slice(0, 80), municipality: municipality.name })}
              />
            </section>

            <Comments
              reportId={report.id}
              path={path}
              currentUserId={user?.id ?? null}
              canModerate={access.isStaff}
              comments={(comments ?? []).map((c) => ({
                id: c.id,
                body: c.body,
                isOfficial: c.is_official,
                isHidden: c.is_hidden,
                photos: c.photos,
                createdAt: c.created_at,
                authorId: c.author_id,
                authorName: c.author?.full_name ?? null,
                authorAvatar: c.author?.avatar_url ?? null,
              }))}
            />
          </article>

          <aside className="space-y-6">
            <section className="overflow-hidden rounded-xl border">
              <Link href={mapHref} aria-label={t("showOnMap")} className="block">
                <ReportMap
                  className="pointer-events-none h-48 w-full"
                  center={[report.lat, report.lng]}
                  zoom={16}
                  interactive={false}
                  defaultStyle={municipality.default_map_style}
                  pins={[{ id: report.id, lat: report.lat, lng: report.lng, color: category.color }]}
                />
              </Link>
              <div className="flex items-start gap-2 p-3 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground">
                    {report.address || `${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`}
                  </p>
                  <Link href={mapHref} className="mt-1 inline-block font-medium underline-offset-4 hover:underline">
                    {t("showOnMap")}
                  </Link>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold">{t("timeline")}</h2>
              <ol className="mt-3 space-y-0">
                {publicEvents.map((event, i) => {
                  const to = event.to_status_id ? statusById.get(event.to_status_id) : null;
                  return (
                    <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                      {i < publicEvents.length - 1 && (
                        <span className="absolute top-3 bottom-0 left-[5px] w-px bg-border" aria-hidden="true" />
                      )}
                      <span
                        className="relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-background ring-1 ring-border"
                        style={{ backgroundColor: to?.color ?? "#a8a29e" }}
                      />
                      <div className="min-w-0 text-sm">
                        <p className="font-medium">
                          {event.type === "created"
                            ? t("events.created")
                            : t("events.status_changed", { status: to ? localized(to.name, locale) : "" })}
                        </p>
                        <TimeAgo date={event.created_at} className="text-xs text-muted-foreground" />
                        {event.note && (
                          <p className="mt-1.5 rounded-md bg-muted px-3 py-2 text-sm whitespace-pre-line">{event.note}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          </aside>
        </div>
        <footer className="mt-12 space-y-3 border-t pt-6">
          {!municipality.is_official && <IndependentNotice municipality={municipality.name} />}
          <LegalLinks />
        </footer>
      </main>
    </div>
  );
}
