"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createAdminClient} from "@/lib/supabase/admin";
import {requireOperationsConsoleAdmin} from "@/lib/operations/console-auth";

type AuditStatus = "succeeded" | "failed" | "rejected";

async function writeAudit(input: {
  actorUserId: string;
  actorEmail: string;
  action: string;
  status: AuditStatus;
  request: Record<string, unknown>;
  result?: unknown;
  error?: string;
}) {
  const admin = createAdminClient();
  const {error} = await admin.from("operations_console_audit").insert({
    actor_user_id: input.actorUserId,
    actor_email: input.actorEmail,
    action: input.action,
    status: input.status,
    input: input.request,
    result: input.result ?? {},
    error: input.error ?? null
  });

  return error?.message ?? null;
}

function consoleUrl(
  kind: "message" | "error",
  message: string
): string {
  return `/operations/events?${kind}=${encodeURIComponent(message)}`;
}

export async function retrySingleEventAction(formData: FormData) {
  const user = await requireOperationsConsoleAdmin();
  const eventId = formData.get("eventId");

  if (typeof eventId !== "string" || !eventId) {
    redirect(consoleUrl("error", "A valid event ID is required."));
  }

  const admin = createAdminClient();
  const {data, error} = await admin.rpc("project_operations_event", {
    p_event_id: eventId
  });

  const auditError = await writeAudit({
    actorUserId: user.id,
    actorEmail: user.email ?? "unknown",
    action: "retry_single_event",
    status: error ? "failed" : "succeeded",
    request: {eventId},
    result: {processed: data},
    error: error?.message
  });

  revalidatePath("/operations/events");
  revalidatePath("/operations");

  if (error) {
    redirect(consoleUrl("error", error.message));
  }

  if (auditError) {
    redirect(
      consoleUrl(
        "error",
        `Event retry completed, but audit logging failed: ${auditError}`
      )
    );
  }

  redirect(
    consoleUrl(
      "message",
      data ? "Event projected successfully." : "Event did not require projection."
    )
  );
}

export async function retryFailedEventsAction(formData: FormData) {
  const user = await requireOperationsConsoleAdmin();
  const rawLimit = formData.get("limit");
  const parsedLimit =
    typeof rawLimit === "string" ? Number.parseInt(rawLimit, 10) : 100;
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(parsedLimit, 500))
    : 100;

  const admin = createAdminClient();
  const {data, error} = await admin.rpc("retry_operations_projection", {
    p_limit: limit
  });

  const rows = Array.isArray(data) ? data : [];
  const processedCount = rows.filter(
    (row) =>
      typeof row === "object" &&
      row !== null &&
      "processed" in row &&
      row.processed === true
  ).length;

  const auditError = await writeAudit({
    actorUserId: user.id,
    actorEmail: user.email ?? "unknown",
    action: "retry_failed_events",
    status: error ? "failed" : "succeeded",
    request: {limit},
    result: {
      attempted: rows.length,
      processed: processedCount
    },
    error: error?.message
  });

  revalidatePath("/operations/events");
  revalidatePath("/operations");

  if (error) {
    redirect(consoleUrl("error", error.message));
  }

  if (auditError) {
    redirect(
      consoleUrl(
        "error",
        `Retry completed, but audit logging failed: ${auditError}`
      )
    );
  }

  redirect(
    consoleUrl(
      "message",
      `Retry complete: ${processedCount} of ${rows.length} events projected.`
    )
  );
}

export async function rebuildProjectionAction(formData: FormData) {
  const user = await requireOperationsConsoleAdmin();
  const confirmation = formData.get("confirmation");

  if (confirmation !== "REBUILD") {
    await writeAudit({
      actorUserId: user.id,
      actorEmail: user.email ?? "unknown",
      action: "rebuild_projection",
      status: "rejected",
      request: {confirmation: String(confirmation ?? "")},
      error: "Required confirmation was not supplied."
    });

    redirect(
      consoleUrl("error", "Type REBUILD exactly to confirm the operation.")
    );
  }

  const admin = createAdminClient();
  const {data, error} = await admin.rpc("rebuild_operations_projection");

  const auditError = await writeAudit({
    actorUserId: user.id,
    actorEmail: user.email ?? "unknown",
    action: "rebuild_projection",
    status: error ? "failed" : "succeeded",
    request: {confirmation: "REBUILD"},
    result: {processedEvents: data},
    error: error?.message
  });

  revalidatePath("/operations/events");
  revalidatePath("/operations");

  if (error) {
    redirect(consoleUrl("error", error.message));
  }

  if (auditError) {
    redirect(
      consoleUrl(
        "error",
        `Rebuild completed, but audit logging failed: ${auditError}`
      )
    );
  }

  redirect(
    consoleUrl(
      "message",
      `Operations projection rebuilt from ${data ?? 0} events.`
    )
  );
}
