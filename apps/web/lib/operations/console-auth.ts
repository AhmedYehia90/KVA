import "server-only";

import {notFound, redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

function configuredAdminEmails(): Set<string> {
  const value = process.env.KVA_OPERATIONS_ADMIN_EMAILS ?? "";

  return new Set(
    value
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isOperationsConsoleAdminEmail(
  email: string | null | undefined
): boolean {
  if (!email) return false;
  return configuredAdminEmails().has(email.trim().toLowerCase());
}

export async function requireOperationsConsoleAdmin() {
  const supabase = await createClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/pilots/login");
  }

  if (!isOperationsConsoleAdminEmail(user.email)) {
    notFound();
  }

  return user;
}
