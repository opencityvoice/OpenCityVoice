"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notifyAssigneeOfComment, notifyCommentSubscribers, notifyStaffOfNewReport } from "@/lib/notifications";

async function requireClaims() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) throw new Error("Not signed in");
  return { supabase, userId: data.claims.sub };
}

export async function toggleVote(reportId: string, path: string) {
  const { supabase, userId } = await requireClaims();
  const { data: existing } = await supabase
    .from("report_votes")
    .select("report_id")
    .eq("report_id", reportId)
    .eq("user_id", userId)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from("report_votes").delete().eq("report_id", reportId).eq("user_id", userId)
    : await supabase.from("report_votes").insert({ report_id: reportId, user_id: userId });
  if (error) return { ok: false as const };
  revalidatePath(path);
  return { ok: true as const, voted: !existing };
}

const commentSchema = z
  .object({
    reportId: z.uuid(),
    body: z.string().trim().max(2000),
    photos: z.array(z.string().max(300)).max(3).default([]),
    parentId: z.uuid().optional(),
  })
  .refine((value) => value.body.length > 0 || value.photos.length > 0);

export async function addComment(
  input: { reportId: string; body: string; photos?: string[]; parentId?: string },
  path: string,
) {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const };
  const { supabase, userId } = await requireClaims();
  const ownPhoto = new RegExp(`^${userId}/[\\w-]+\\.jpg$`);
  if (parsed.data.photos.some((p) => !ownPhoto.test(p))) return { ok: false as const };

  if (parsed.data.parentId) {
    const { data: parent } = await supabase
      .from("report_comments")
      .select("id, report_id")
      .eq("id", parsed.data.parentId)
      .eq("report_id", parsed.data.reportId)
      .maybeSingle();
    if (!parent) return { ok: false as const };
  }

  const { error } = await supabase.from("report_comments").insert({
    report_id: parsed.data.reportId,
    body: parsed.data.body,
    photos: parsed.data.photos,
    parent_id: parsed.data.parentId ?? null,
    author_id: userId,
  });
  if (error) return { ok: false as const };
  // Commenting subscribes the user to future comment notifications on this report.
  await supabase
    .from("report_subscriptions")
    .upsert({ report_id: parsed.data.reportId, user_id: userId }, { onConflict: "report_id,user_id" });
  after(async () => {
    await Promise.all([
      notifyAssigneeOfComment(parsed.data.reportId, userId, parsed.data.body),
      notifyCommentSubscribers(parsed.data.reportId, userId, parsed.data.body),
    ]);
  });
  revalidatePath(path);
  return { ok: true as const };
}

export async function setReportSubscription(reportId: string, subscribed: boolean, path: string) {
  const { supabase, userId } = await requireClaims();
  const { error } = subscribed
    ? await supabase
        .from("report_subscriptions")
        .upsert({ report_id: reportId, user_id: userId }, { onConflict: "report_id,user_id" })
    : await supabase.from("report_subscriptions").delete().eq("report_id", reportId).eq("user_id", userId);
  if (error) return { ok: false as const };
  revalidatePath(path);
  return { ok: true as const };
}

export async function deleteComment(commentId: string, path: string) {
  const { supabase } = await requireClaims();
  const { error } = await supabase.from("report_comments").delete().eq("id", commentId);
  if (error) return { ok: false as const };
  revalidatePath(path);
  return { ok: true as const };
}

const createReportSchema = z.object({
  municipalityId: z.uuid(),
  categoryId: z.uuid(),
  title: z.string().trim().max(120).optional(),
  description: z.string().trim().min(3).max(4000),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().trim().max(300).optional(),
  photos: z.array(z.string().max(300)).max(4),
});

export type CreateReportResult =
  | { ok: true; number: number }
  | { ok: false; error: "invalid" | "outside" | "rateLimited" | "failed" };

export async function createReport(input: z.input<typeof createReportSchema>): Promise<CreateReportResult> {
  const parsed = createReportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await requireClaims();
  const data = parsed.data;

  // Photos must live in the author's own storage folder.
  if (data.photos.some((p) => !p.startsWith(`${userId}/`))) return { ok: false, error: "invalid" };

  const { data: inside } = await supabase.rpc("point_in_municipality", {
    p_municipality_id: data.municipalityId,
    p_lat: data.lat,
    p_lng: data.lng,
  });
  if (inside === false) return { ok: false, error: "outside" };

  const { data: report, error } = await supabase
    .from("reports")
    .insert({
      municipality_id: data.municipalityId,
      category_id: data.categoryId,
      author_id: userId,
      title: data.title || null,
      description: data.description,
      lat: data.lat,
      lng: data.lng,
      address: data.address || null,
      photos: data.photos,
      // Assigned by the prepare_new_report trigger.
      number: 0,
      status_id: "00000000-0000-0000-0000-000000000000",
    })
    .select("id, number")
    .single();
  if (error?.message === "rate_limited") return { ok: false, error: "rateLimited" };
  if (error || !report) {
    console.error("[createReport]", error);
    return { ok: false, error: "failed" };
  }

  after(() => notifyStaffOfNewReport(report.id));
  revalidatePath(`/`, "layout");
  return { ok: true, number: report.number };
}
