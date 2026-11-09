import "server-only";
import {notFound, redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {activeOperationsStaff} from "@/lib/auth/security";

export function isOperationsConsoleAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.KVA_OPERATIONS_ADMIN_EMAILS ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

export async function getOperationsConsoleAccess() {
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user || !isOperationsConsoleAdminEmail(user.email)) return {user, allowed: false};
  const {data: profile, error} = await supabase.from("profiles").select("role,status").eq("id", user.id).maybeSingle();
  return {user, allowed: !error && activeOperationsStaff(profile)};
}

export async function requireOperationsConsoleAdmin() {
  const {user, allowed} = await getOperationsConsoleAccess();
  if (!user) redirect("/pilots/login");
  if (!allowed) notFound();
  return user;
}
