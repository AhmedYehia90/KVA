"use server";

import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {validNewPassword} from "@/lib/auth/security";

export async function resetPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (!validNewPassword(password, confirmation)) redirect("/pilots/reset-password?error=password");
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) redirect("/pilots/login?error=callback");
  let failed = false;
  try {
    const {error} = await supabase.auth.updateUser({password});
    failed = Boolean(error);
  } catch {
    failed = true;
  }
  if (failed) redirect("/pilots/reset-password?error=unavailable");
  const {error: signOutError} = await supabase.auth.signOut({scope: "global"});
  if (signOutError) redirect("/pilots/login?error=unavailable");
  redirect("/pilots/login?message=password-updated");
}
