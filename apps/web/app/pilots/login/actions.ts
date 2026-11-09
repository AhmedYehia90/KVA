"use server";

import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {signInFailure, validEmail} from "@/lib/auth/security";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/pilots/login?error=missing");
  if (!validEmail(email) || password.length > 4096) redirect("/pilots/login?error=invalid");
  let failure: "invalid" | "unavailable" | "limited" | null = null;
  try {
    const supabase = await createClient();
    const {error} = await supabase.auth.signInWithPassword({email, password});
    if (error) failure = signInFailure(error);
  } catch {
    failure = "unavailable";
  }
  if (failure) redirect(`/pilots/login?error=${failure}`);
  redirect("/pilot/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  const {error} = await supabase.auth.signOut({scope: "local"});
  if (error) redirect("/pilots/login?error=unavailable");
  redirect("/");
}
