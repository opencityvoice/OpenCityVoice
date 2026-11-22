"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { sendEmail, emailBrand } from "@/lib/email";
import { configuredLocale, defaultLocale, localized } from "@/i18n/config";
import { siteUrl } from "@/lib/config";

type Result = { ok: true } | { ok: false; error?: string };

/** Loads a report the current user may manage (RLS limits updates to approved staff). */
async function staffContext(reportId: string) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return null;
  const { data: report } = await supabase
    .from("reports")
    .select("id, number, title, description, municipality_id, author_id, status_id, is_hidden, municipalities(slug, name, primary_color, logo_path)")
    .eq("id", reportId)
    .single();
  if (!report) return null;
  const { data: isStaff } = await supabase.rpc("is_municipality_staff", { mid: report.municipality_id });
  if (!isStaff) return null;
  return { supabase, userId: claims.claims.sub, report };
}

function revalidateReport(slug: string, number: number) {
  revalidatePath(`/${slug}/manage`);
  revalidatePath(`/${slug}/reports/${number}`);
  revalidatePath(`/${slug}`);
}

const statusSchema = z.object({
  reportId: z.uuid(),
  statusId: z.uuid(),
  note: z.string().trim().max(2000).optional(),
});

export async function updateStatus(input: z.input<typeof statusSchema>): Promise<Result> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const ctx = await staffContext(parsed.data.reportId);
  if (!ctx) return { ok: false, error: "forbidden" };
  const { supabase, report, userId } = ctx;
  if (report.status_id === parsed.data.statusId) return { ok: true };

  const { data: status } = await supabase
    .from("statuses")
    .select("id, name, municipality_id")
    .eq("id", parsed.data.statusId)
    .single();
  if (!status || status.municipality_id !== report.municipality_id) return { ok: false };

  const { error } = await supabase.from("reports").update({ status_id: status.id }).eq("id", report.id);
  if (error) return { ok: false };

  const admin = createAdminClient();
  const note = parsed.data.note || null;
  if (note) {
    const { data: event } = await admin
      .from("report_events")
      .select("id")
      .eq("report_id", report.id)
      .eq("type", "status_changed")
      .eq("actor_id", userId)
      .eq("to_status_id", status.id)
      .is("note", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (event) await admin.from("report_events").update({ note }).eq("id", event.id);
  }

  await notifyAuthor(report, status.name, note);
  revalidateReport(report.municipalities!.slug, report.number);
  return { ok: true };
}

/** E-mails the report's author, and authors of reports merged into it, about a status change. */
async function notifyAuthor(
  report: NonNullable<Awaited<ReturnType<typeof staffContext>>>["report"],
  statusName: unknown,
  note: string | null,
) {
  const admin = createAdminClient();
  // Authors of merged duplicates only hear about the original while it is public.
  const { data: merged } = report.is_hidden
    ? { data: [] }
    : await admin.from("reports").select("author_id").eq("duplicate_of", report.id);
  const authorIds = [...new Set([report.author_id, ...(merged ?? []).map((r) => r.author_id)])];
  const municipality = report.municipalities!;
  const title = report.title || report.description.slice(0, 80);

  await Promise.all(
    authorIds.map(async (authorId) => {
      const { data: author } = await admin
        .from("profiles")
        .select("email_notifications, locale")
        .eq("id", authorId)
        .single();
      if (!author?.email_notifications) return;
      const { data: user } = await admin.auth.admin.getUserById(authorId);
      const email = user?.user?.email;
      if (!email) return;

      const locale = author.locale ?? configuredLocale() ?? defaultLocale;
      const t = await getTranslations({ locale, namespace: "email" });
      const status = localized(statusName, locale);
      await sendEmail({
        to: email,
        subject: t("statusSubject", { number: report.number, status }),
        paragraphs: [t("statusIntro", { title, municipality: municipality.name, status })],
        quote: note ? { label: t("statusNote"), text: note } : null,
        action: { label: t("viewReport"), url: `${siteUrl}/${municipality.slug}/reports/${report.number}` },
        footer: t("unsubscribe", { url: `${siteUrl}/profile` }),
        accentColor: municipality.primary_color,
        brand: emailBrand(municipality),
      });
    }),
  );
}

export async function mergeReport(reportId: string, targetNumber: number): Promise<Result> {
  if (!Number.isInteger(targetNumber) || targetNumber < 1) return { ok: false, error: "invalid" };
  const ctx = await staffContext(reportId);
  if (!ctx) return { ok: false, error: "forbidden" };
  const { data: number, error } = await ctx.supabase.rpc("merge_report", {
    p_duplicate_id: reportId,
    p_target_number: targetNumber,
  });
  if (error || !number) return { ok: false, error: "invalid" };
  const slug = ctx.report.municipalities!.slug;
  after(() => notifyMergedAuthor(ctx.report, number));
  revalidateReport(slug, ctx.report.number);
  revalidateReport(slug, number);
  return { ok: true };
}

async function notifyMergedAuthor(
  report: NonNullable<Awaited<ReturnType<typeof staffContext>>>["report"],
  targetNumber: number,
) {
  const admin = createAdminClient();
  const { data: author } = await admin
    .from("profiles")
    .select("email_notifications, locale")
    .eq("id", report.author_id)
    .single();
  if (!author?.email_notifications) return;
  const { data: user } = await admin.auth.admin.getUserById(report.author_id);
  const email = user?.user?.email;
  if (!email) return;

  const locale = author.locale ?? configuredLocale() ?? defaultLocale;
  const t = await getTranslations({ locale, namespace: "email" });
  const municipality = report.municipalities!;
  await sendEmail({
    to: email,
    subject: t("mergedSubject", { number: report.number, target: targetNumber }),
    paragraphs: [t("mergedIntro", { number: report.number, target: targetNumber, municipality: municipality.name })],
    action: { label: t("viewReport"), url: `${siteUrl}/${municipality.slug}/reports/${targetNumber}` },
    footer: t("unsubscribe", { url: `${siteUrl}/profile` }),
    accentColor: municipality.primary_color,
    brand: emailBrand(municipality),
  });
}

export async function assignReport(reportId: string, assigneeId: string | null): Promise<Result> {
  const ctx = await staffContext(reportId);
  if (!ctx) return { ok: false, error: "forbidden" };
  const { supabase, report, userId } = ctx;

  if (assigneeId) {
    const { data: member } = await supabase
      .from("municipality_members")
      .select("user_id")
      .eq("municipality_id", report.municipality_id)
      .eq("user_id", assigneeId)
      .eq("status", "approved")
      .maybeSingle();
    if (!member) return { ok: false };
  }
  const { error } = await supabase.from("reports").update({ assignee_id: assigneeId }).eq("id", report.id);
  if (error) return { ok: false };

  if (assigneeId && assigneeId !== userId) {
    const admin = createAdminClient();
    const [{ data: user }, { data: profile }] = await Promise.all([
      admin.auth.admin.getUserById(assigneeId),
      admin.from("profiles").select("locale").eq("id", assigneeId).single(),
    ]);
    const email = user?.user?.email;
    if (email) {
      const t = await getTranslations({ locale: profile?.locale ?? configuredLocale() ?? defaultLocale, namespace: "email" });
      const municipality = report.municipalities!;
      await sendEmail({
        to: email,
        subject: t("assignSubject", { number: report.number, municipality: municipality.name }),
        paragraphs: [t("assignIntro", { number: report.number, title: report.title || report.description.slice(0, 80) })],
        action: { label: t("openDashboard"), url: `${siteUrl}/${municipality.slug}/manage?report=${report.id}` },
        accentColor: municipality.primary_color,
      brand: emailBrand(municipality),
      });
    }
  }
  revalidateReport(report.municipalities!.slug, report.number);
  return { ok: true };
}

const forwardSchema = z.object({
  reportId: z.uuid(),
  email: z.email().optional(),
  message: z.string().trim().max(2000).optional(),
});

export async function forwardReport(
  input: z.input<typeof forwardSchema>,
): Promise<{ ok: true; url: string } | { ok: false }> {
  const parsed = forwardSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const ctx = await staffContext(parsed.data.reportId);
  if (!ctx) return { ok: false };
  const { supabase, report, userId } = ctx;

  const { data: forward, error } = await supabase
    .from("report_forwards")
    .insert({
      report_id: report.id,
      sent_by: userId,
      recipient_email: parsed.data.email ?? null,
      message: parsed.data.message || null,
    })
    .select("token, expires_at")
    .single();
  if (error || !forward) {
    console.error("[forwardReport]", error);
    return { ok: false };
  }

  const url = `${siteUrl}/f/${forward.token}`;
  if (parsed.data.email) {
    const municipality = report.municipalities!;
    const t = await getTranslations("email");
    const { data: sender } = await supabase.from("profiles").select("full_name").eq("id", userId).single();
    await sendEmail({
      to: parsed.data.email,
      subject: t("forwardSubject", { number: report.number, municipality: municipality.name }),
      paragraphs: [
        t("forwardIntro", { sender: sender?.full_name ?? municipality.name, municipality: municipality.name, number: report.number }),
        report.title || report.description,
      ],
      quote: parsed.data.message ? { label: t("forwardMessage"), text: parsed.data.message } : null,
      action: { label: t("openReport"), url },
      accentColor: municipality.primary_color,
      brand: emailBrand(municipality),
    });
  }
  revalidateReport(report.municipalities!.slug, report.number);
  return { ok: true, url };
}

export async function deleteReport(reportId: string): Promise<Result> {
  const ctx = await staffContext(reportId);
  if (!ctx) return { ok: false };
  const { error } = await ctx.supabase.from("reports").delete().eq("id", reportId);
  if (error) return { ok: false };
  revalidatePath(`/${ctx.report.municipalities!.slug}`, "layout");
  return { ok: true };
}
