import {createClient} from "@/lib/supabase/server";
import type {FleetType} from "@/types/database";

export async function getFleetTypes(): Promise<FleetType[]> {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from("fleet_types")
    .select("*")
    .eq("active", true)
    .order("manufacturer")
    .order("model");

  if (error) throw new Error(`Unable to load fleet types: ${error.message}`);
  return (data ?? []) as FleetType[];
}
