"use server";

import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {scheduledBookingEnabled} from "@/lib/scheduling/mode";

export async function bookFlightAction(formData: FormData) {
  const routeId = formData.get("routeId");

  if (typeof routeId !== "string" || !routeId) {
    redirect(
      `/pilot/flights?error=${encodeURIComponent("Invalid flight selection.")}`
    );
  }

  const supabase = await createClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/pilots/login");
  }

  if (await scheduledBookingEnabled(supabase)) redirect("/pilot/schedule");

  const {data: bookingId, error} = await supabase.rpc("book_route", {
    p_route_id: routeId
  });

  if (error) {
    redirect(
      `/pilot/flights/${routeId}?error=${encodeURIComponent(error.message)}`
    );
  }

  redirect(`/pilot/bookings/${bookingId}`);
}
