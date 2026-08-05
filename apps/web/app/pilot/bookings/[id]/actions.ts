"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

export async function advanceFlightAction(formData: FormData) {
  const bookingId = formData.get("bookingId");

  if (typeof bookingId !== "string" || !bookingId) {
    redirect("/pilot/bookings");
  }

  const supabase = await createClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/pilots/login");
  }

  const {error} = await supabase.rpc("advance_flight_booking", {
    p_booking_id: bookingId
  });

  if (error) {
    redirect(
      `/pilot/bookings/${bookingId}?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath(`/pilot/bookings/${bookingId}`);
  revalidatePath("/pilot/bookings");
  revalidatePath("/pilot/flights");
  revalidatePath("/pilot/dashboard");
  revalidatePath("/live-flights");
  revalidatePath("/operations");

  redirect(`/pilot/bookings/${bookingId}`);
}
