import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabaseUrl, supabasePublishableKey, supabaseSecretKey } from "@/lib/config";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component; the proxy refreshes the session instead.
          }
        },
      },
    },
  );
}

/** Service-role client. Bypasses RLS: only use on the server after an explicit permission check. */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    supabaseUrl,
    supabaseSecretKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
