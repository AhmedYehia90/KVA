"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

const transitions: Record<string, string> = {
  booked: "boarding",
  boarding: "departed",
  departed: "enroute",
  enroute: "landed",
  landed: "completed"
};

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

  const {data: booking, error: bookingError} = await supabase
    .from("flight_bookings")
    .select("id, status")
    .eq("id", bookingId)
    .eq("pilot_id", user.id)
    .maybeSingle();

  if (bookingError || !booking) {
    redirect(
      `/pilot/bookings/${bookingId}?error=${encodeURIComponent(
        bookingError?.message ?? "Booking not found."
      )}`
    );
  }

  const nextStatus = transitions[booking.status];

  if (!nextStatus) {
    redirect(`/pilot/bookings/${bookingId}`);
  }

  const now = new Date().toISOString();
  const update: {
    status: string;
    started_at?: string;
    completed_at?: string;
  } = {
    status: nextStatus
  };

  if (booking.status === "booked") {
    update.started_at = now;
  }

  if (nextStatus === "completed") {
    update.completed_at = now;
  }

  const {error: updateError} = await supabase
    .from("flight_bookings")
    .update(update)
    .eq("id", bookingId)
    .eq("pilot_id", user.id)
    .eq("status", booking.status);

  if (updateError) {
    redirect(
      `/pilot/bookings/${bookingId}?error=${encodeURIComponent(
        updateError.message
      )}`
    );
  }

  revalidatePath(`/pilot/bookings/${bookingId}`);
  revalidatePath("/pilot/bookings");
  revalidatePath("/pilot/flights");
  revalidatePath("/pilot/dashboard");
  revalidatePath("/live-flights");

  redirect(`/pilot/bookings/${bookingId}`);
}
