import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { singleMunicipality } from "@/lib/config";
import { MUNICIPALITY_COLUMNS, REPORT_LIST_COLUMNS, type ReportListItem } from "@/lib/types";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", claims.sub).single();
  if (!profile) return null;
  return { id: claims.sub, email: (claims.email as string | undefined) ?? null, profile };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(next: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** Returns null instead of a 404 when the municipality does not exist or is not visible. */
export const findMunicipality = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("municipalities").select(MUNICIPALITY_COLUMNS).eq("slug", slug).maybeSingle();
  return data;
});

export const getMunicipality = cache(async (slug: string) => {
  if (singleMunicipality && slug !== singleMunicipality) notFound();
  const data = await findMunicipality(slug);
  if (!data) notFound();
  return data;
});

export const getBoundary = cache(async (municipalityId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("municipality_boundary_geojson", { p_municipality_id: municipalityId });
  return (data as GeoJSON.Geometry | null) ?? null;
});

export const getCategories = cache(async (municipalityId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("municipality_id", municipalityId)
    .order("sort_order");
  return data ?? [];
});

export const getStatuses = cache(async (municipalityId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("statuses").select("*").eq("municipality_id", municipalityId).order("sort_order");
  return data ?? [];
});

const PAGE_SIZE = 1000; // Matches the Supabase API max_rows default.

export async function getReports(municipalityId: string, limit = 2000): Promise<ReportListItem[]> {
  const supabase = await createClient();
  const reports: ReportListItem[] = [];
  while (reports.length < limit) {
    const from = reports.length;
    const to = Math.min(from + PAGE_SIZE, limit) - 1;
    const { data } = await supabase
      .from("reports")
      .select(REPORT_LIST_COLUMNS)
      .eq("municipality_id", municipalityId)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to);
    if (!data?.length) break;
    reports.push(...data);
    if (data.length < to - from + 1) break;
  }
  return reports;
}

/** A single list item, for linking to a report that falls outside the capped `getReports` result. */
export async function getReportListItem(municipalityId: string, reportId: string): Promise<ReportListItem | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select(REPORT_LIST_COLUMNS)
    .eq("municipality_id", municipalityId)
    .eq("is_hidden", false)
    .eq("id", reportId)
    .maybeSingle();
  return data;
}

/** Ids of reports in a municipality the current user has voted for. */
export async function getVotedReportIds(municipalityId: string): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("report_votes")
    .select("report_id, reports!inner(municipality_id)")
    .eq("user_id", user.id)
    .eq("reports.municipality_id", municipalityId);
  return (data ?? []).map((v) => v.report_id);
}

export const getMembership = cache(async (municipalityId: string) => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("municipality_members")
    .select("*")
    .eq("municipality_id", municipalityId)
    .eq("user_id", user.id)
    .maybeSingle();
  return data;
});

/** Access level of the current user in a municipality. */
export async function getAccess(municipalityId: string) {
  const user = await getCurrentUser();
  if (!user) return { user: null, isStaff: false, isAdmin: false };
  if (user.profile.is_platform_admin) return { user, isStaff: true, isAdmin: true };
  const membership = await getMembership(municipalityId);
  const approved = membership?.status === "approved";
  return { user, isStaff: approved, isAdmin: approved && membership?.role === "admin" };
}

export async function getApprovedMembers(municipalityId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("municipality_members")
    .select("user_id, role, job_title, profiles(full_name, avatar_url)")
    .eq("municipality_id", municipalityId)
    .eq("status", "approved");
  return (data ?? []).map((m) => ({
    id: m.user_id,
    role: m.role,
    jobTitle: m.job_title,
    name: m.profiles?.full_name ?? null,
    avatarUrl: m.profiles?.avatar_url ?? null,
  }));
}

export type StaffMember = Awaited<ReturnType<typeof getApprovedMembers>>[number];
