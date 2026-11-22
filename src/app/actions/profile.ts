"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  fullName: z.string().trim().max(80),
  emailNotifications: z.boolean(),
  commentNotifications: z.boolean(),
});

export async function updateProfile(input: z.input<typeof schema>) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { ok: false as const };
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName || null,
      email_notifications: parsed.data.emailNotifications,
      comment_notifications: parsed.data.commentNotifications,
    })
    .eq("id", data.claims.sub);
  if (error) return { ok: false as const };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

const preferencesSchema = z.object({
  municipalityId: z.uuid(),
  categoryIds: z.array(z.uuid()).max(200),
  comments: z.boolean(),
});

export async function updateNotificationPreferences(input: z.input<typeof preferencesSchema>) {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_notification_preferences", {
    p_municipality_id: parsed.data.municipalityId,
    p_category_ids: parsed.data.categoryIds,
    p_comments: parsed.data.comments,
  });
  return { ok: !error };
}
