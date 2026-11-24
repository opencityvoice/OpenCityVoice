"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, Forward, Link2, List, Loader2, Map as MapIcon, MapPin, MessageSquare, Search, ThumbsUp, Trash2, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReportMap, type MapPin as Pin } from "@/components/map/report-map";
import { CategoryLabel, StatusBadge, TimeAgo } from "@/components/report-bits";
import { PhotoGallery } from "@/components/photo-gallery";
import { assignReport, deleteReport, forwardReport, mergeReport, updateStatus } from "@/app/actions/manage";
import { createClient } from "@/lib/supabase/client";
import { localized } from "@/i18n/config";

import { cn } from "@/lib/utils";
import type { StaffMember } from "@/lib/data";
import type { Category, PublicMunicipality, ReportListItem, Status } from "@/lib/types";

type Props = {
  municipality: PublicMunicipality;
  categories: Category[];
  statuses: Status[];
  reports: ReportListItem[];
  recentVotes: Record<string, number>;
  members: StaffMember[];
  boundary: GeoJSON.Geometry | null;
  currentUserId: string;
  isAdmin: boolean;
  initialSelected: string | null;
};

type Sort = "newest" | "oldest" | "votes" | "trending";
type Filters = { category: string; status: string; assignee: string; from: string; to: string; q: string; minVotes: number; sort: Sort };
const emptyFilters: Filters = { category: "", status: "open", assignee: "", from: "", to: "", q: "", minVotes: 0, sort: "newest" };
const voteThresholds = [1, 5, 10, 25, 50];

export function Dashboard(props: Props) {
  const { municipality, categories, statuses, reports, recentVotes, members, boundary, currentUserId } = props;
  const t = useTranslations("manage");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [selectedId, setSelectedId] = useState<string | null>(props.initialSelected);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number; padding?: { right?: number } } | null>(() => {
    const r = props.initialSelected ? reports.find((x) => x.id === props.initialSelected) : null;
    return r ? { lat: r.lat, lng: r.lng, zoom: 16 } : null;
  });
  const [mobileView, setMobileView] = useState<"list" | "map">("list");

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const from = filters.from ? new Date(filters.from).getTime() : null;
    const to = filters.to ? new Date(filters.to).getTime() + 86_400_000 : null;
    const result = reports.filter((r) => {
      const status = statusById.get(r.status_id);
      if (filters.category && r.category_id !== filters.category) return false;
      if (filters.status === "open" && status?.is_closed) return false;
      if (filters.status && filters.status !== "open" && r.status_id !== filters.status) return false;
      if (filters.assignee === "none" && r.assignee_id) return false;
      if (filters.assignee === "me" && r.assignee_id !== currentUserId) return false;
      if (filters.assignee && !["none", "me"].includes(filters.assignee) && r.assignee_id !== filters.assignee) return false;
      const created = new Date(r.created_at).getTime();
      if (from && created < from) return false;
      if (to && created >= to) return false;
      if (q && !`#${r.number} ${r.title ?? ""} ${r.description} ${r.address ?? ""}`.toLowerCase().includes(q)) return false;
      if (r.vote_count < filters.minVotes) return false;
      return true;
    });
    const byDate = (a: ReportListItem, b: ReportListItem) => b.created_at.localeCompare(a.created_at);
    const compare: Record<Sort, (a: ReportListItem, b: ReportListItem) => number> = {
      newest: byDate,
      oldest: (a, b) => -byDate(a, b),
      votes: (a, b) => b.vote_count - a.vote_count || byDate(a, b),
      trending: (a, b) => (recentVotes[b.id] ?? 0) - (recentVotes[a.id] ?? 0) || b.vote_count - a.vote_count || byDate(a, b),
    };
    return result.sort(compare[filters.sort]);
  }, [reports, filters, statusById, currentUserId, recentVotes]);

  const [loadedAt] = useState(() => Date.now());
  const stats = useMemo(() => {
    const weekAgo = loadedAt - 7 * 86_400_000;
    const closed = reports.filter((r) => statusById.get(r.status_id)?.is_closed).length;
    return {
      total: reports.length,
      open: reports.length - closed,
      newThisWeek: reports.filter((r) => new Date(r.created_at).getTime() > weekAgo).length,
      closed,
    };
  }, [reports, statusById, loadedAt]);

  const pins: Pin[] = useMemo(
    () =>
      filtered.map((r) => ({
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        color: categoryById.get(r.category_id)?.color ?? "#64748b",
        closed: statusById.get(r.status_id)?.is_closed,
      })),
    [filtered, categoryById, statusById],
  );

  const selected = selectedId ? reports.find((r) => r.id === selectedId) ?? null : null;
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  function selectReport(r: ReportListItem) {
    setSelectedId(r.id);
    setFocus({ lat: r.lat, lng: r.lng, zoom: 16, padding: { right: window.innerWidth >= 768 ? 420 : 0 } });
  }
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(emptyFilters);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b bg-muted/30">
        <div className="flex flex-wrap items-end gap-2 px-4 py-3">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder={t("search")} className="h-9 bg-background pl-8" />
          </div>
          <NativeSelect value={filters.category} onChange={(e) => set({ category: e.target.value })} className="w-[calc(50%-4px)] sm:w-48" aria-label={t("table.category")}>
            <option value="">{t("table.category")}: {tc("all")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{localized(c.name, locale)}</option>
            ))}
          </NativeSelect>
          <NativeSelect value={filters.status} onChange={(e) => set({ status: e.target.value })} className="w-[calc(50%-4px)] sm:w-40" aria-label={t("status")}>
            <option value="">{t("status")}: {tc("all")}</option>
            <option value="open">{t("stats.open")}</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>{localized(s.name, locale)}</option>
            ))}
          </NativeSelect>
          <NativeSelect value={filters.assignee} onChange={(e) => set({ assignee: e.target.value })} className="w-[calc(50%-4px)] sm:w-44" aria-label={t("assignee")}>
            <option value="">{t("assignee")}: {t("anyone")}</option>
            <option value="me">{t("mine")}</option>
            <option value="none">{t("unassigned")}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name ?? m.id.slice(0, 8)}</option>
            ))}
          </NativeSelect>
          <NativeSelect value={String(filters.minVotes)} onChange={(e) => set({ minVotes: Number(e.target.value) })} className="w-[calc(50%-4px)] sm:w-44" aria-label={t("minVotes")}>
            <option value="0">{t("anyVotes")}</option>
            {voteThresholds.map((n) => (
              <option key={n} value={n}>{t("minVotesOption", { count: n })}</option>
            ))}
          </NativeSelect>
          <NativeSelect value={filters.sort} onChange={(e) => set({ sort: e.target.value as Sort })} className="w-[calc(50%-4px)] sm:w-52" aria-label={t("sort")}>
            {(["newest", "oldest", "votes", "trending"] as const).map((key) => (
              <option key={key} value={key}>{t(`sortOptions.${key}`)}</option>
            ))}
          </NativeSelect>
          <div className="flex w-[calc(50%-4px)] items-center gap-1 sm:w-auto">
            <Input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} className="h-9 bg-background sm:w-36" aria-label={t("dateFrom")} />
            <span className="text-muted-foreground">–</span>
            <Input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} className="h-9 bg-background sm:w-36" aria-label={t("dateTo")} />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-9" onClick={() => setFilters(emptyFilters)}>
              <X />
              {t("clearFilters")}
            </Button>
          )}
          <dl className="ml-auto hidden gap-5 text-right xl:flex">
            {(["total", "open", "newThisWeek", "closed"] as const).map((key) => (
              <div key={key}>
                <dt className="text-[11px] text-muted-foreground">{t(`stats.${key}`)}</dt>
                <dd className="text-lg leading-tight font-semibold tabular-nums">{stats[key]}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <aside className={cn("flex min-h-0 w-full flex-col border-r md:w-[380px] md:shrink-0 xl:w-[440px]", mobileView === "map" && "hidden md:flex")}>
          <div className="border-b px-4 py-2 text-xs text-muted-foreground">
            {filtered.length} / {reports.length}
          </div>
          <ul className="min-h-0 flex-1 divide-y overflow-y-auto pb-20 md:pb-0">
            {filtered.map((r) => {
              const status = statusById.get(r.status_id);
              const category = categoryById.get(r.category_id);
              const assignee = r.assignee_id ? memberById.get(r.assignee_id) : null;
              return (
                <li key={r.id}>
                  <button
                    onClick={() => selectReport(r)}
                    className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-muted/60", selectedId === r.id && "bg-muted")}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">#{r.number}</span>
                        <TimeAgo date={r.created_at} />
                        <span className="inline-flex items-center gap-0.5"><ThumbsUp className="size-3" />{r.vote_count}</span>
                        <span className="inline-flex items-center gap-0.5"><MessageSquare className="size-3" />{r.comment_count}</span>
                        {(recentVotes[r.id] ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-0.5 font-medium text-emerald-700">
                            <TrendingUp className="size-3" />
                            {t("recentVotes", { count: recentVotes[r.id]! })}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-sm font-medium">{r.title || r.description}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        {status && <StatusBadge name={status.name} color={status.color} />}
                        {category && <CategoryLabel name={category.name} icon={category.icon} color={category.color} />}
                      </div>
                    </div>
                    <span className="mt-0.5 max-w-24 shrink-0 truncate text-xs text-muted-foreground">
                      {assignee ? assignee.name : ""}
                    </span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="px-4 py-12 text-center text-sm text-muted-foreground">{tc("none")}</li>}
          </ul>
        </aside>

        <section className={cn("relative min-h-0 flex-1", mobileView === "list" && "hidden md:block")}>
          <ReportMap
            className="absolute inset-0"
            center={[municipality.center_lat, municipality.center_lng]}
            zoom={municipality.default_zoom}
            defaultStyle={municipality.default_map_style}
            pins={pins}
            boundary={boundary}
            selectedId={selectedId}
            onSelect={setSelectedId}
            focus={focus}
          />
        </section>

        {selected && (
          <ReportPanel
            key={selected.id}
            report={selected}
            {...props}
            mergedIntoNumber={selected.duplicate_of ? (reports.find((r) => r.id === selected.duplicate_of)?.number ?? null) : null}
            onClose={() => setSelectedId(null)}
            categoryById={categoryById}
            statusById={statusById}
          />
        )}

        <div className="pb-safe absolute inset-x-0 bottom-0 flex justify-center px-3 pt-3 md:hidden">
          <Button variant="outline" className="h-11 bg-background px-5 shadow-md" onClick={() => setMobileView(mobileView === "list" ? "map" : "list")}>
            {mobileView === "list" ? <MapIcon /> : <List />}
            {mobileView === "list" ? tc("map") : tc("list")}
          </Button>
        </div>
      </div>
    </div>
  );
}

type PanelProps = Props & {
  report: ReportListItem;
  mergedIntoNumber: number | null;
  onClose: () => void;
  categoryById: Map<string, Category>;
  statusById: Map<string, Status>;
};

type Candidate = { id: string; number: number; title: string | null; description: string; distance_m: number };

type EventRow = { id: string; type: string; note: string | null; created_at: string; to_status_id: string | null; assignee_id: string | null };

function ReportPanel({ report, mergedIntoNumber, municipality, statuses, members, isAdmin, onClose, categoryById, statusById }: PanelProps) {
  const t = useTranslations("manage");
  const tr = useTranslations("report");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [statusId, setStatusId] = useState(report.status_id);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [targetNumber, setTargetNumber] = useState("");
  const category = categoryById.get(report.category_id);
  const status = statusById.get(report.status_id);
  const publicUrl = `/${municipality.slug}/reports/${report.number}`;

  useEffect(() => {
    createClient()
      .from("report_events")
      .select("id, type, note, created_at, to_status_id, assignee_id")
      .eq("report_id", report.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setEvents(data ?? []));
  }, [report.id, report.status_id, report.assignee_id]);

  useEffect(() => {
    if (report.duplicate_of) return;
    createClient()
      .rpc("nearby_reports", { p_municipality_id: municipality.id, p_lat: report.lat, p_lng: report.lng, p_radius_m: 150 })
      .then(({ data }) => setCandidates((data ?? []).filter((r) => r.id !== report.id).slice(0, 5)));
  }, [report.id, report.lat, report.lng, report.duplicate_of, municipality.id]);

  function merge(number: number) {
    if (!confirm(t("mergeConfirm", { number }))) return;
    startTransition(async () => {
      const result = await mergeReport(report.id, number);
      if (result.ok) {
        toast.success(t("merged", { number }));
        setTargetNumber("");
        router.refresh();
      } else toast.error(t("mergeFailed"));
    });
  }

  function saveStatus() {
    startTransition(async () => {
      const result = await updateStatus({ reportId: report.id, statusId, note: note || undefined });
      if (result.ok) {
        toast.success(t("statusUpdated"));
        setNote("");
        router.refresh();
      } else toast.error(tc("error"));
    });
  }

  function assign(value: string) {
    startTransition(async () => {
      const result = await assignReport(report.id, value || null);
      if (result.ok) {
        toast.success(t("assigned"));
        router.refresh();
      } else toast.error(tc("error"));
    });
  }

  function remove() {
    if (!confirm(t("deleteReportConfirm"))) return;
    startTransition(async () => {
      const result = await deleteReport(report.id);
      if (result.ok) {
        onClose();
        router.refresh();
      } else toast.error(tc("error"));
    });
  }

  const memberName = (id: string | null) => (id ? members.find((m) => m.id === id)?.name ?? "—" : null);

  return (
    <aside className="absolute inset-0 z-20 flex flex-col bg-background md:inset-y-0 md:right-0 md:left-auto md:w-[420px] md:border-l md:shadow-xl">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-sm text-muted-foreground">#{report.number}</span>
        {status && <StatusBadge name={status.name} color={status.color} />}
        <div className="ml-auto flex items-center">
          <Button variant="ghost" size="icon" render={<Link href={publicUrl} target="_blank" />} nativeButton={false} aria-label={t("openPublicPage")}>
            <ExternalLink />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={tc("close")}>
            <X />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-4">
          <h2 className="text-lg leading-snug font-semibold">{report.title || report.description.slice(0, 80)}</h2>
          {category && <CategoryLabel name={category.name} icon={category.icon} color={category.color} className="mt-2" />}
          <p className="mt-1 text-xs text-muted-foreground">
            <TimeAgo date={report.created_at} /> · <ThumbsUp className="inline size-3" /> {report.vote_count} · {report.comment_count} {tr("comments").toLowerCase()}
          </p>
          {report.photos.length > 0 && <PhotoGallery paths={report.photos} className="mt-4" />}
          <p className="mt-4 text-sm leading-relaxed whitespace-pre-line">{report.description}</p>
          <p className="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            {report.address || `${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`}
          </p>
        </div>

        <div className="space-y-5 border-t p-4">
          <div className="space-y-2">
            <Label>{t("assignee")}</Label>
            <NativeSelect value={report.assignee_id ?? ""} onChange={(e) => assign(e.target.value)} disabled={pending}>
              <option value="">{t("unassigned")}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.id.slice(0, 8)}
                  {m.jobTitle ? ` · ${m.jobTitle}` : ""}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label>{t("changeStatus")}</Label>
            <NativeSelect value={statusId} onChange={(e) => setStatusId(e.target.value)} disabled={pending}>
              {statuses.filter((s) => s.is_active || s.id === report.status_id).map((s) => (
                <option key={s.id} value={s.id}>{localized(s.name, locale)}</option>
              ))}
            </NativeSelect>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("statusNotePlaceholder")} rows={3} maxLength={2000} />
            <Button onClick={saveStatus} disabled={pending || (statusId === report.status_id)} className="w-full">
              {pending && <Loader2 className="animate-spin" />}
              {t("updateStatus")}
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="merge-target">{t("markDuplicate")}</Label>
            {report.duplicate_of ? (
              <p className="text-sm text-muted-foreground">
                {mergedIntoNumber ? (
                  <Link href={`/${municipality.slug}/reports/${mergedIntoNumber}`} target="_blank" className="underline underline-offset-4">
                    {t("mergedInto", { number: mergedIntoNumber })}
                  </Link>
                ) : (
                  t("mergedInto", { number: "?" })
                )}
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">{t("markDuplicateText")}</p>
                {candidates.length > 0 && (
                  <ul className="space-y-1.5">
                    {candidates.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm">
                        <span className="font-mono text-xs text-muted-foreground">#{c.number}</span>
                        <span className="min-w-0 flex-1 truncate">{c.title || c.description}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{Math.round(c.distance_m)} m</span>
                        <Button size="xs" variant="outline" onClick={() => merge(c.number)} disabled={pending}>
                          {t("mergeInto")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <Input
                    id="merge-target"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    placeholder={t("targetNumber")}
                    value={targetNumber}
                    onChange={(e) => setTargetNumber(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    onClick={() => merge(Number(targetNumber))}
                    disabled={pending || !Number.isInteger(Number(targetNumber)) || Number(targetNumber) < 1}
                  >
                    {t("mergeInto")}
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setForwardOpen(true)}>
              <Forward />
              {t("forward")}
            </Button>
            <Button variant="outline" render={<Link href={`${publicUrl}#comments`} target="_blank" />} nativeButton={false}>
              {t("officialComment")}
            </Button>
            {isAdmin && (
              <Button variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={remove} disabled={pending}>
                <Trash2 />
                {t("deleteReport")}
              </Button>
            )}
          </div>
        </div>

        <div className="border-t p-4">
          <h3 className="text-sm font-semibold">{tr("timeline")}</h3>
          <ol className="mt-3 space-y-3">
            {events.map((e) => {
              const to = e.to_status_id ? statusById.get(e.to_status_id) : null;
              const label =
                e.type === "created"
                  ? tr("events.created")
                  : e.type === "status_changed"
                    ? tr("events.status_changed", { status: to ? localized(to.name, locale) : "" })
                    : e.type === "assigned"
                      ? e.assignee_id
                        ? tr("events.assigned", { name: memberName(e.assignee_id) ?? "" })
                        : tr("events.unassigned")
                      : tr("events.forwarded");
              return (
                <li key={e.id} className="text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{label}</span>
                    <TimeAgo date={e.created_at} className="shrink-0 text-xs text-muted-foreground" />
                  </div>
                  {e.note && <p className="mt-1 rounded-md bg-muted px-2.5 py-1.5 text-xs whitespace-pre-line">{e.note}</p>}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <ForwardDialog open={forwardOpen} onOpenChange={setForwardOpen} reportId={report.id} number={report.number} />
    </aside>
  );
}

function ForwardDialog({ open, onOpenChange, reportId, number }: { open: boolean; onOpenChange: (open: boolean) => void; reportId: string; number: number }) {
  const t = useTranslations("manage");
  const tc = useTranslations("common");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send(withEmail: boolean) {
    startTransition(async () => {
      const result = await forwardReport({ reportId, email: withEmail ? email : undefined, message: message || undefined });
      if (!result.ok) return void toast.error(tc("error"));
      router.refresh();
      if (withEmail) {
        toast.success(t("forwardSent"));
        onOpenChange(false);
      } else {
        setLink(result.url);
        await navigator.clipboard?.writeText(result.url).catch(() => undefined);
        toast.success(t("linkCreated"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) setLink(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("forwardTitle", { number })}</DialogTitle>
          <DialogDescription>{t("forwardText")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="fw-email">{t("recipientEmail")}</Label>
            <Input id="fw-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fw-message">{t("message")} <span className="font-normal text-muted-foreground">({tc("optional")})</span></Label>
            <Textarea id="fw-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("messagePlaceholder")} rows={3} />
          </div>
          {link && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
              <Input readOnly value={link} className="h-8 bg-background font-mono text-xs" onFocus={(e) => e.target.select()} />
            </div>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => send(false)} disabled={pending}>
              <Link2 />
              {t("createLink")}
            </Button>
            <Button onClick={() => send(true)} disabled={pending || !/^\S+@\S+\.\S+$/.test(email)}>
              {pending && <Loader2 className="animate-spin" />}
              {t("sendEmail")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

