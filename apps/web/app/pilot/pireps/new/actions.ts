"use server";

import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

function optionalInteger(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function submitPirepAction(formData: FormData) {
  const bookingId = formData.get("bookingId");
  const blockMinutes = optionalInteger(formData.get("blockMinutes"));
  const landingRate = optionalInteger(formData.get("landingRate"));
  const fuelUsedKg = optionalNumber(formData.get("fuelUsedKg"));
  const remarks = formData.get("remarks");

  if (typeof bookingId !== "string" || !bookingId || !blockMinutes) {
    redirect(
      `/pilot/pireps/new?booking=${encodeURIComponent(
        typeof bookingId === "string" ? bookingId : ""
      )}&error=${encodeURIComponent("Booking and block time are required.")}`
    );
  }

  const supabase = await createClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  const {data: pirepId, error} = await supabase.rpc(
    "submit_booking_pirep",
    {
      p_booking_id: bookingId,
      p_block_minutes: blockMinutes,
      p_landing_rate: landingRate,
      p_fuel_used_kg: fuelUsedKg,
      p_remarks: typeof remarks === "string" ? remarks : null
    }
  );

  if (error) {
    redirect(
      `/pilot/pireps/new?booking=${bookingId}&error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  redirect(`/pilot/pireps?submitted=${pirepId}`);
}
