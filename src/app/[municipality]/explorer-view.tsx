"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, List, Map as MapIcon, MessageSquare, Plus, ThumbsUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportMap, type MapPin } from "@/components/map/report-map";
import { VoteChip } from "@/components/vote-chip";
import { CategoryLabel, StatusBadge, TimeAgo } from "@/components/report-bits";
import { CategoryIcon } from "@/components/category-icon";
import { IndependentNotice, LegalLinks } from "@/components/legal-links";
import { useLocale, useTranslations } from "next-intl";
import { localized } from "@/i18n/config";
import { photoUrl } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { Category, PublicMunicipality, ReportListItem, Status } from "@/lib/types";

type Props = {
  municipality: PublicMunicipality;
  categories: Category[];
  statuses: Status[];
  reports: ReportListItem[];
  boundary: GeoJSON.Geometry | null;
  initialSelected: string | null;
  votedIds: string[];
  signedIn: boolean;
};

export function ExplorerView({ municipality, categories, statuses, reports, boundary, initialSelected, votedIds, signedIn }: Props) {
  const t = useTranslations("explorer");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [openOnly, setOpenOnly] = useState(true);
  const [sort, setSort] = useState<"newest" | "votes">("newest");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelected);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const votedSet = useMemo(() => new Set(votedIds), [votedIds]);
  const pagePath = `/${municipality.slug}`;

  const visible = useMemo(() => {
    const list = reports.filter(
      (r) =>
        categoryById.has(r.category_id) &&
        (activeCategories.length === 0 || activeCategories.includes(r.category_id)) &&
        (!openOnly || !statusById.get(r.status_id)?.is_closed),
    );
    if (sort === "votes") list.sort((a, b) => b.vote_count - a.vote_count);
    return list;
  }, [reports, activeCategories, openOnly, sort, categoryById, statusById]);

  const pins: MapPin[] = useMemo(
    () =>
      visible.map((r) => ({
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        color: categoryById.get(r.category_id)?.color ?? "#64748b",
        closed: statusById.get(r.status_id)?.is_closed,
      })),
    [visible, categoryById, statusById],
  );

  const selected = selectedId ? reports.find((r) => r.id === selectedId) : null;
  const initialReport = initialSelected ? reports.find((r) => r.id === initialSelected) : undefined;

  function toggleCategory(id: string) {
    setActiveCategories((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));
  }

  const reportLink = (r: ReportListItem) => `/${municipality.slug}/reports/${r.number}`;

  return (
    <div className="relative flex min-h-0 flex-1">
      {/* Sidebar list (desktop) / full list (mobile list view) */}
      <aside
        className={cn(
          "flex min-h-0 w-full flex-col border-r bg-background md:w-[400px] md:shrink-0 lg:w-[440px]",
          mobileView === "map" && "hidden md:flex",
        )}
      >
        {renderFilters()}
        <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
          <span>
            {t("reports", { count: visible.length })}
          </span>
          <div className="flex gap-1">
            {(["newest", "votes"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={cn("rounded px-2 py-1", sort === s ? "bg-muted font-medium text-foreground" : "hover:text-foreground")}
              >
                {s === "newest" ? t("sortNewest") : t("sortVotes")}
              </button>
            ))}
          </div>
        </div>
        <ul className="min-h-0 flex-1 divide-y overflow-y-auto pb-24 md:pb-4">
          {visible.map((r) => {
            const category = categoryById.get(r.category_id)!;
            const status = statusById.get(r.status_id);
            return (
              <li key={r.id} className="relative flex">
                <Link
                  href={reportLink(r)}
                  onMouseEnter={() => setSelectedId(r.id)}
                  className={cn(
                    "flex min-w-0 flex-1 gap-3 px-4 py-3.5 hover:bg-muted/60 after:absolute after:inset-0 after:content-['']",
                    selectedId === r.id && "md:bg-muted/60",
                  )}
                >
                  <ReportThumb report={r} category={category} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-1 font-medium">{r.title || r.description}</p>
                      {status && <StatusBadge name={status.name} color={status.color} className="shrink-0" />}
                    </div>
                    <CategoryLabel name={category.name} icon={category.icon} color={category.color} className="mt-1" />
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>#{r.number}</span>
                      <TimeAgo date={r.created_at} />
                      {r.duplicate_of && (
                        <span className="inline-flex items-center gap-1">
                          <ThumbsUp className="size-3" />
                          {r.vote_count}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="size-3" />
                        {r.comment_count}
                      </span>
                    </div>
                  </div>
                </Link>
                {!r.duplicate_of && (
                  <div className="relative z-10 flex items-center pr-3">
                    <VoteChip
                      reportId={r.id}
                      count={r.vote_count}
                      voted={votedSet.has(r.id)}
                      signedIn={signedIn}
                      path={pagePath}
                    />
                  </div>
                )}
              </li>
            );
          })}
          {visible.length === 0 && <li className="px-4 py-12 text-center text-sm text-muted-foreground">{t("empty")}</li>}
          <li className="space-y-2 px-4 py-4">
            {!municipality.is_official && <IndependentNotice municipality={municipality.name} />}
            <LegalLinks />
          </li>
        </ul>
      </aside>

      {/* Map */}
      <section className={cn("relative min-h-0 flex-1", mobileView === "list" && "hidden md:block")}>
        <ReportMap
          className="absolute inset-0 [&_.maplibregl-ctrl-bottom-right]:mb-[72px] md:[&_.maplibregl-ctrl-bottom-right]:mb-0"
          center={initialReport ? [initialReport.lat, initialReport.lng] : [municipality.center_lat, municipality.center_lng]}
          zoom={initialReport ? Math.max(municipality.default_zoom, 16) : municipality.default_zoom}
          defaultStyle={municipality.default_map_style}
          pins={pins}
          boundary={boundary}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <div className="absolute inset-x-0 top-0 md:hidden">
          {renderChips("px-3 pt-3 pb-1", true)}
        </div>
        {selected && (
          <div className="absolute inset-x-3 bottom-20 md:right-auto md:bottom-6 md:left-6 md:w-96">
            {renderSelectedCard(selected)}
          </div>
        )}
      </section>

      {/* Mobile bottom bar */}
      <div className="pb-safe absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 px-3 pt-3 md:hidden">
        <Button
          variant="outline"
          className="h-12 flex-1 bg-background shadow-sm"
          onClick={() => setMobileView(mobileView === "map" ? "list" : "map")}
        >
          {mobileView === "map" ? <List /> : <MapIcon />}
          {mobileView === "map" ? tc("list") : tc("map")}
        </Button>
        <Button className="h-12 flex-[2] shadow-sm" render={<Link href={`/${municipality.slug}/new`} />} nativeButton={false}>
          <Plus />
          {tc("reportIssue")}
        </Button>
      </div>
      <Button
        className="absolute top-4 right-4 hidden h-10 shadow-md md:inline-flex"
        render={<Link href={`/${municipality.slug}/new`} />}
        nativeButton={false}
      >
        <Plus />
        {tc("reportIssue")}
      </Button>
    </div>
  );

  function renderFilters() {
    return (
      <div className="border-b px-4 py-3">
        {renderChips("hidden md:flex md:flex-wrap")}
        <label className="flex items-center gap-2 text-sm md:mt-3">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          {t("openOnly")}
        </label>
      </div>
    );
  }

  function renderChips(className?: string, floating?: boolean) {
    return (
      <div className={cn("flex gap-1.5 overflow-x-auto [scrollbar-width:none]", className)}>
        {activeCategories.length > 0 && (
          <button
            onClick={() => setActiveCategories([])}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-medium",
              floating ? "bg-background shadow-sm" : "bg-muted",
            )}
          >
            <X className="size-3" />
            {tc("all")}
          </button>
        )}
        {categories.filter((c) => c.is_active).map((c) => {
          const active = activeCategories.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggleCategory(c.id)}
              aria-pressed={active}
              className={cn(
                "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border pr-3 pl-1 text-xs font-medium whitespace-nowrap transition-colors",
                active ? "" : "bg-background hover:bg-muted",
                floating && "shadow-sm",
              )}
              style={
                active
                  ? { borderColor: c.color, backgroundColor: `color-mix(in oklch, ${c.color} 14%, white)` }
                  : undefined
              }
            >
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: c.color }}
              >
                <CategoryIcon name={c.icon} className="size-3 text-white" />
              </span>
              {localized(c.name, locale)}
            </button>
          );
        })}
      </div>
    );
  }

  function renderSelectedCard(report: ReportListItem) {
    const category = categoryById.get(report.category_id);
    const status = statusById.get(report.status_id);
    return (
      <div className="relative flex overflow-hidden rounded-xl border bg-background shadow-lg">
        <button
          onClick={() => setSelectedId(null)}
          className="absolute top-2 right-2 z-20 rounded-full bg-background/90 p-1.5 text-muted-foreground hover:text-foreground"
          aria-label={tc("close")}
        >
          <X className="size-4" />
        </button>
        <Link href={reportLink(report)} className="flex min-w-0 flex-1 gap-3 p-3 after:absolute after:inset-0 after:content-['']">
          {category && <ReportThumb report={report} category={category} large />}
          <div className="min-w-0 flex-1 pr-6">
            {status && <StatusBadge name={status.name} color={status.color} />}
            <p className="mt-1.5 line-clamp-2 font-medium leading-snug">{report.title || report.description}</p>
            {category && <CategoryLabel name={category.name} icon={category.icon} color={category.color} className="mt-1.5" />}
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <TimeAgo date={report.created_at} />
              {report.duplicate_of && (
                <span className="inline-flex items-center gap-1">
                  <ThumbsUp className="size-3" />
                  {report.vote_count}
                </span>
              )}
              <span className="ml-auto inline-flex items-center font-medium text-foreground">
                {t("viewDetails")}
                <ChevronRight className="size-3.5" />
              </span>
            </div>
          </div>
        </Link>
        {!report.duplicate_of && (
          <div className="relative z-10 flex items-center pr-3">
            <VoteChip
              reportId={report.id}
              count={report.vote_count}
              voted={votedSet.has(report.id)}
              signedIn={signedIn}
              path={pagePath}
            />
          </div>
        )}
      </div>
    );
  }
}

function ReportThumb({ report, category, large }: { report: ReportListItem; category: Category; large?: boolean }) {
  const size = large ? "size-20" : "size-14";
  if (report.photos[0]) {
    return (
      <Image
        src={photoUrl(report.photos[0])}
        alt=""
        width={large ? 160 : 112}
        height={large ? 160 : 112}
        className={cn(size, "shrink-0 rounded-lg bg-muted object-cover")}
        unoptimized
      />
    );
  }
  return (
    <div
      className={cn(size, "flex shrink-0 items-center justify-center rounded-lg")}
      style={{ backgroundColor: `color-mix(in oklch, ${category.color} 12%, white)` }}
    >
      <CategoryIcon name={category.icon} className="size-5" />
    </div>
  );
}
