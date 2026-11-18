import {createClient} from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

// Both the application flag and the server-controlled database mode must agree.
// Missing RPC/config or an outage preserves the legacy entry point.
export async function scheduledBookingEnabled(client?: Client): Promise<boolean> {
  if (process.env.KVA_SCHEDULING_PHASE1_ENABLED !== "true") return false;
  try {
    const database = client ?? await createClient();
    const {data, error} = await database.rpc("scheduling_mode_enabled");
    return !error && data === true;
  } catch {
    return false;
  }
}
