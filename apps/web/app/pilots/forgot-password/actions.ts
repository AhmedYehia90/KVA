"use server";

import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {validEmail, signInFailure} from "@/lib/auth/security";

export async function requestPasswordReset(formData: FormData) {
  if (process.env.KVA_PASSWORD_RECOVERY_ENABLED !== "true") redirect("/pilots/forgot-password?message=contact");
  const email = String(formData.get("email") ?? "").trim();
  if (!validEmail(email)) redirect("/pilots/forgot-password?error=email");
  let unavailable = false;
  try {
    const supabase = await createClient();
    const {error} = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://kva-web-beta.vercel.app/auth/callback?next=%2Fpilots%2Freset-password",
    });
    // Never disclose whether an address belongs to an account.
    unavailable = Boolean(error && signInFailure(error) !== "invalid");
  } catch {
    unavailable = true;
  }
  redirect(unavailable ? "/pilots/forgot-password?error=unavailable" : "/pilots/forgot-password?message=sent");
}
