"use server";

import {notFound, redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {validScheduleId} from "@/lib/scheduling/format";
import {scheduledBookingEnabled} from "@/lib/scheduling/mode";

async function scheduleMutation(formData: FormData, kind: "book" | "cancel") {
  if (process.env.KVA_SCHEDULING_PHASE1_ENABLED !== "true") notFound();
  const id = formData.get(kind === "book" ? "scheduleId" : "bookingId");
  if (!validScheduleId(id)) redirect("/pilot/schedule?error=invalid");
  const client = await createClient();
  const {data: {user}, error: authError} = await client.auth.getUser();
  if (authError || !user) redirect("/pilots/login");
  if (!await scheduledBookingEnabled(client)) notFound();
  const {error} = await client.rpc(kind === "book" ? "book_scheduled_flight" : "cancel_scheduled_booking", {
    [kind === "book" ? "p_schedule" : "p_booking"]: id
  });
  if (error) redirect("/pilot/schedule?error=unavailable");
  revalidatePath("/pilot/schedule");
  revalidatePath("/pilot/bookings");
  redirect("/pilot/schedule?message=" + (kind === "book" ? "booked" : "cancelled"));
}

export async function bookScheduledFlight(formData: FormData) {
  return scheduleMutation(formData, "book");
}
export async function cancelScheduledBooking(formData: FormData) {
  return scheduleMutation(formData, "cancel");
}
