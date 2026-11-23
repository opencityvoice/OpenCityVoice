import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabaseUrl, supabasePublishableKey } from "@/lib/config";

export function createClient() {
  return createBrowserClient<Database>(
    supabaseUrl,
    supabasePublishableKey,
  );
}
