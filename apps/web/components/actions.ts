"use server";

import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

export async function signOutAction() {
  const supabase = await createClient();
  const {error} = await supabase.auth.signOut({scope: "local"});
  if (error) redirect("/pilots/login?error=unavailable");
  redirect("/");
}
