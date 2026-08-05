import "server-only";

import {createAdminClient} from "@/lib/supabase/admin";

export async function getCoreHealthData() {
  const admin = createAdminClient();

  const [health, deadLetters, aircraft, drafts] = await Promise.all([
    admin.from("event_platform_health").select("*").maybeSingle(),
    admin
      .from("event_dead_letters")
      .select("id,event_id,consumer_name,attempts,last_error,dead_lettered_at")
      .is("resolved_at", null)
      .order("dead_lettered_at", {ascending: false})
      .limit(50),
    admin
      .from("aircraft_operational_state")
      .select("aircraft_id,operational_status,last_event_type,last_event_at")
      .order("updated_at", {ascending: false})
      .limit(100),
    admin
      .from("auto_pirep_drafts")
      .select("id,booking_id,flight_number,suggested_block_minutes,status,created_at")
      .order("created_at", {ascending: false})
      .limit(50)
  ]);

  const firstError =
    health.error ?? deadLetters.error ?? aircraft.error ?? drafts.error;

  if (firstError) {
    throw new Error(`Unable to load Core Health: ${firstError.message}`);
  }

  return {
    health: health.data ?? {
      total_events: 0,
      processed_events: 0,
      failed_events: 0,
      pending_events: 0,
      dead_letter_events: 0,
      health_status: "healthy"
    },
    deadLetters: deadLetters.data ?? [],
    aircraftStates: aircraft.data ?? [],
    drafts: drafts.data ?? []
  };
}
