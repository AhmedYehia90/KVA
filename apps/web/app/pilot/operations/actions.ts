"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

export async function advanceOperationAction(formData: FormData) {
  const bookingId = formData.get("bookingId");

  if (typeof bookingId !== "string" || !bookingId) {
    redirect("/pilot/operations");
  }

  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  const {error} = await supabase.rpc("advance_flight_operation", {
    p_booking_id: bookingId
  });

  if (error) {
    redirect(`/pilot/operations?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/pilot/operations");
  revalidatePath("/pilot/dashboard");
  revalidatePath(`/pilot/bookings/${bookingId}`);
  revalidatePath("/live-flights");
  redirect("/pilot/operations");
}
