import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { getUserNotifications } from "@/lib/user-notifications";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ items: [] }, { status: 401 });
  const items = await getUserNotifications(user.id);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((id): id is string => typeof id === "string").slice(0, 100)
    : [];
  if (!ids.length) return NextResponse.json({ ok: true });

  const supabase = await createClient();
  const { error } = await supabase.from("notification_reads").upsert(
    ids.map((notification_id) => ({ user_id: user.id, notification_id })),
    { onConflict: "user_id,notification_id", ignoreDuplicates: true },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
