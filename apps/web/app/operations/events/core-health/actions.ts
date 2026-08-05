"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createAdminClient} from "@/lib/supabase/admin";
import {requireOperationsConsoleAdmin} from "@/lib/operations/console-auth";

function target(kind: "message" | "error", value: string) {
  return `/operations/events/core-health?${kind}=${encodeURIComponent(value)}`;
}

export async function retryDueEventsAction(formData: FormData) {
  const user = await requireOperationsConsoleAdmin();
  const raw = formData.get("limit");
  const parsed = typeof raw === "string" ? Number.parseInt(raw, 10) : 100;
  const limit = Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 500)) : 100;
  const admin = createAdminClient();

  const {data, error} = await admin.rpc("retry_operations_projection", {
    p_limit: limit
  });

  await admin.from("operations_console_audit").insert({
    actor_user_id: user.id,
    actor_email: user.email ?? "unknown",
    action: "retry_due_events",
    status: error ? "failed" : "succeeded",
    input: {limit},
    result: {rows: Array.isArray(data) ? data.length : 0},
    error: error?.message ?? null
  });

  revalidatePath("/operations/events/core-health");
  revalidatePath("/operations/events");
  revalidatePath("/operations");

  if (error) redirect(target("error", error.message));

  redirect(
    target(
      "message",
      `Retry scan completed for ${Array.isArray(data) ? data.length : 0} events.`
    )
  );
}

export async function requeueDeadLetterAction(formData: FormData) {
  const user = await requireOperationsConsoleAdmin();
  const deadLetterId = formData.get("deadLetterId");

  if (typeof deadLetterId !== "string" || !deadLetterId) {
    redirect(target("error", "A valid dead-letter ID is required."));
  }

  const admin = createAdminClient();
  const {data, error} = await admin.rpc("requeue_dead_letter", {
    p_dead_letter_id: deadLetterId
  });

  await admin.from("operations_console_audit").insert({
    actor_user_id: user.id,
    actor_email: user.email ?? "unknown",
    action: "requeue_dead_letter",
    status: error ? "failed" : "succeeded",
    input: {deadLetterId},
    result: {status: data},
    error: error?.message ?? null
  });

  revalidatePath("/operations/events/core-health");
  revalidatePath("/operations/events");
  revalidatePath("/operations");

  if (error) redirect(target("error", error.message));
  redirect(target("message", `Dead letter returned with status ${data}.`));
}
