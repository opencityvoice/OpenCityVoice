import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];

export type Profile = Tables["profiles"]["Row"];
export type Municipality = Tables["municipalities"]["Row"];
export type Member = Tables["municipality_members"]["Row"];
export type Category = Tables["categories"]["Row"];
export type Status = Tables["statuses"]["Row"];
export type Report = Tables["reports"]["Row"];
export type ReportComment = Tables["report_comments"]["Row"];
export type ReportEvent = Tables["report_events"]["Row"];
export type MemberRole = Database["public"]["Enums"]["member_role"];

/** Columns needed to render reports on the map and in lists. */
export const REPORT_LIST_COLUMNS =
  "id, number, title, description, category_id, status_id, assignee_id, lat, lng, address, photos, vote_count, comment_count, duplicate_of, created_at, updated_at" as const;

export type ReportListItem = Pick<
  Report,
  | "id"
  | "number"
  | "title"
  | "description"
  | "category_id"
  | "status_id"
  | "assignee_id"
  | "lat"
  | "lng"
  | "address"
  | "photos"
  | "vote_count"
  | "comment_count"
  | "duplicate_of"
  | "created_at"
  | "updated_at"
>;

export type PublicMunicipality = Omit<Municipality, "boundary" | "report_seq">;

export const MUNICIPALITY_COLUMNS =
  "id, slug, name, contact_email, website_url, primary_color, center_lat, center_lng, default_zoom, logo_path, is_active, is_official, default_map_style, created_at" as const;
