import "server-only";
import { createClient } from "@/lib/supabase/server";

export type UserNotification = {
  id: string;
  kind: "comment" | "status";
  createdAt: string;
  reportId: string;
  reportNumber: number;
  reportTitle: string;
  municipalitySlug: string;
  municipalityName: string;
  authorName: string | null;
  body: string | null;
  statusName: unknown;
  statusColor: string | null;
  read: boolean;
};

const MAX_REPORTS = 100;
const MAX_ITEMS = 30;

/** Recent comments and status changes on reports the user authored, follows, or is assigned to. */
export async function getUserNotifications(userId: string): Promise<UserNotification[]> {
  const supabase = await createClient();
  const [subs, authored, assigned] = await Promise.all([
    supabase
      .from("report_subscriptions")
      .select("report_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_REPORTS),
    supabase
      .from("reports")
      .select("id")
      .eq("author_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_REPORTS),
    supabase
      .from("reports")
      .select("id")
      .eq("assignee_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_REPORTS),
  ]);

  const ids = [
    ...new Set(
      [...(subs.data ?? []), ...(authored.data ?? []), ...(assigned.data ?? [])].map((r) =>
        "report_id" in r ? r.report_id : r.id,
      ),
    ),
  ].slice(0, MAX_REPORTS);
  if (!ids.length) return [];

  const [reportsRes, commentsRes, eventsRes] = await Promise.all([
    supabase
      .from("reports")
      .select("id, number, title, description, municipalities(slug, name)")
      .in("id", ids),
    supabase
      .from("report_comments")
      .select("id, report_id, body, created_at, author:profiles(full_name)")
      .in("report_id", ids)
      .eq("is_hidden", false)
      .neq("author_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_ITEMS),
    supabase
      .from("report_events")
      .select("id, report_id, created_at, actor_id, to_status_id")
      .in("report_id", ids)
      .eq("type", "status_changed")
      .order("created_at", { ascending: false })
      .limit(MAX_ITEMS),
  ]);

  const statusIds = [
    ...new Set((eventsRes.data ?? []).map((e) => e.to_status_id).filter((id): id is string => Boolean(id))),
  ];
  const { data: statuses } = statusIds.length
    ? await supabase.from("statuses").select("id, name, color").in("id", statusIds)
    : { data: [] as { id: string; name: unknown; color: string }[] };
  const statusById = new Map((statuses ?? []).map((s) => [s.id, s]));

  const reportById = new Map((reportsRes.data ?? []).map((r) => [r.id, r]));
  const base = (reportId: string) => {
    const r = reportById.get(reportId);
    if (!r) return null;
    return {
      reportId: r.id,
      reportNumber: r.number,
      reportTitle: r.title || r.description.slice(0, 80),
      municipalitySlug: r.municipalities?.slug ?? "",
      municipalityName: r.municipalities?.name ?? "",
    };
  };

  const items: Omit<UserNotification, "read">[] = [];
  for (const c of commentsRes.data ?? []) {
    const b = base(c.report_id);
    if (!b) continue;
    items.push({
      ...b,
      id: `comment:${c.id}`,
      kind: "comment",
      createdAt: c.created_at,
      authorName: c.author?.full_name ?? null,
      body: c.body,
      statusName: null,
      statusColor: null,
    });
  }
  for (const e of eventsRes.data ?? []) {
    if (e.actor_id === userId) continue;
    const b = base(e.report_id);
    if (!b) continue;
    const status = e.to_status_id ? statusById.get(e.to_status_id) : null;
    items.push({
      ...b,
      id: `status:${e.id}`,
      kind: "status",
      createdAt: e.created_at,
      authorName: null,
      body: null,
      statusName: status?.name ?? null,
      statusColor: status?.color ?? null,
    });
  }

  const sorted = items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, MAX_ITEMS);
  if (!sorted.length) return [];

  const notificationIds = sorted.map((i) => i.id);
  const { data: reads } = await supabase
    .from("notification_reads")
    .select("notification_id")
    .eq("user_id", userId)
    .in("notification_id", notificationIds);
  const readIds = new Set((reads ?? []).map((r) => r.notification_id));

  return sorted.map((i) => ({ ...i, read: readIds.has(i.id) }));
}
