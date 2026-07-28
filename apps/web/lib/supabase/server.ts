import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";
import {getSupabaseEnv} from "./env";

export async function createClient() {
  const {url, key, isConfigured} = getSupabaseEnv();

  if (!isConfigured || !url || !key) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({name, value, options}) =>
            cookieStore.set(name, value, options)
          );
        } catch {}
      }
    }
  });
}
