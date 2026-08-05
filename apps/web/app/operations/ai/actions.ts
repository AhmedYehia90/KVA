"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createAdminClient} from "@/lib/supabase/admin";
import {requireOperationsConsoleAdmin} from "@/lib/operations/console-auth";

function consoleUrl(kind: "message" | "error", value: string) {
  return `/operations/ai?${kind}=${encodeURIComponent(value)}`;
}

async function writeAudit(input: {
  actorUserId: string;
  actorEmail: string;
  action:
    | "run_smart_operations_ai"
    | "acknowledge_operations_finding"
    | "resolve_operations_finding"
    | "reopen_operations_finding";
  status: "succeeded" | "failed";
  request: Record<string, unknown>;
  result?: unknown;
  error?: string;
}) {
  const admin = createAdminClient();

  return admin.from("operations_console_audit").insert({
    actor_user_id: input.actorUserId,
    actor_email: input.actorEmail,
    action: input.action,
    status: input.status,
    input: input.request,
    result: input.result ?? {},
    error: input.error ?? null
  });
}

export async function runSmartOperationsAnalysisAction() {
  const user = await requireOperationsConsoleAdmin();
  const admin = createAdminClient();

  const {data, error} = await admin.rpc("run_smart_operations_analysis", {
    p_organization_id: "kalabsha-airlines",
    p_requested_by: user.id,
    p_trigger_type: "manual"
  });

  await writeAudit({
    actorUserId: user.id,
    actorEmail: user.email ?? "unknown",
    action: "run_smart_operations_ai",
    status: error ? "failed" : "succeeded",
    request: {organizationId: "kalabsha-airlines"},
    result: {runId: data},
    error: error?.message
  });

  revalidatePath("/operations/ai");
  revalidatePath("/operations");
  revalidatePath("/operations/events");

  if (error) {
    redirect(consoleUrl("error", error.message));
  }

  redirect(
    consoleUrl(
      "message",
      `Smart Operations analysis completed. Run ${String(data)}.`
    )
  );
}

export async function updateSmartFindingStatusAction(formData: FormData) {
  const user = await requireOperationsConsoleAdmin();
  const findingId = formData.get("findingId");
  const status = formData.get("status");
  const note = formData.get("note");

  if (typeof findingId !== "string" || !findingId) {
    redirect(consoleUrl("error", "A valid finding ID is required."));
  }

  if (
    status !== "open" &&
    status !== "acknowledged" &&
    status !== "resolved"
  ) {
    redirect(consoleUrl("error", "A valid finding status is required."));
  }

  const action =
    status === "acknowledged"
      ? "acknowledge_operations_finding"
      : status === "resolved"
        ? "resolve_operations_finding"
        : "reopen_operations_finding";

  const admin = createAdminClient();
  const {data, error} = await admin.rpc(
    "set_smart_operations_finding_status",
    {
      p_finding_id: findingId,
      p_status: status,
      p_actor_id: user.id,
      p_note: typeof note === "string" ? note : null
    }
  );

  await writeAudit({
    actorUserId: user.id,
    actorEmail: user.email ?? "unknown",
    action,
    status: error ? "failed" : "succeeded",
    request: {
      findingId,
      status,
      note: typeof note === "string" ? note : null
    },
    result: {updated: data},
    error: error?.message
  });

  revalidatePath("/operations/ai");
  revalidatePath("/operations");

  if (error) {
    redirect(consoleUrl("error", error.message));
  }

  redirect(
    consoleUrl(
      "message",
      `Finding status changed to ${status}.`
    )
  );
}
