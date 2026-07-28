import {createBrowserClient} from "@supabase/ssr";
import {getSupabaseEnv} from "./env";

export function createClient() {
  const {url, key, isConfigured} = getSupabaseEnv();

  if (!isConfigured || !url || !key) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return createBrowserClient(url, key);
}
