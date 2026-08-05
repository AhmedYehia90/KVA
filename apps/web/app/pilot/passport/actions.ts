"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

export async function updatePassportVisibilityAction(formData: FormData) {
  const visibility = formData.get("visibility");

  if (
    visibility !== "private" &&
    visibility !== "network" &&
    visibility !== "public"
  ) {
    redirect("/pilot/passport?error=Invalid%20visibility.");
  }

  const supabase = await createClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  const {error} = await supabase
    .from("pilot_passports")
    .update({
      visibility,
      updated_at: new Date().toISOString()
    })
    .eq("pilot_id", user.id);

  if (error) {
    redirect(`/pilot/passport?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/pilot/passport");
  redirect("/pilot/passport?message=Passport%20visibility%20updated.");
}
