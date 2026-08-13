"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requireOperationsConsoleAdmin} from "@/lib/operations/console-auth";
import {createAdminClient} from "@/lib/supabase/admin";

const ORG = "kalabsha-airlines";

function url(kind: "message" | "error", value: string) {
  return `/operations/history?${kind}=${encodeURIComponent(value)}`;
}

function requiredText(fd: FormData, key: string) {
  const value = fd.get(key);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

function optionalText(fd: FormData, key: string) {
  const value = fd.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function optionalDate(fd: FormData, key: string) {
  const value = fd.get(key);
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : null;
}

function entryId(fd: FormData) {
  const value = fd.get("entryId");
  if (typeof value !== "string" || !value) {
    throw new Error("A valid history entry is required.");
  }
  return value;
}

function refreshMuseum() {
  revalidatePath("/operations/history");
  revalidatePath("/pilot/history/company");
}

export async function createHistoryEntryAction(fd: FormData) {
  const user = await requireOperationsConsoleAdmin();
  const admin = createAdminClient();

  try {
    const {error} = await admin.rpc("create_museum_company_history_entry", {
      p_organization_id: ORG,
      p_category: requiredText(fd, "category"),
      p_title: requiredText(fd, "title"),
      p_summary: requiredText(fd, "summary"),
      p_details: optionalText(fd, "details"),
      p_occurred_on: optionalDate(fd, "occurredOn"),
      p_era_label: optionalText(fd, "eraLabel"),
      p_source_label: optionalText(fd, "sourceLabel"),
      p_source_reference: optionalText(fd, "sourceReference"),
      p_actor_id: user.id,
    });

    if (error) throw error;
  } catch (error) {
    redirect(
      url(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to create curated history entry.",
      ),
    );
  }

  refreshMuseum();
  redirect(url("message", "Curated history draft created."));
}

export async function updateHistoryEntryAction(fd: FormData) {
  const user = await requireOperationsConsoleAdmin();
  const admin = createAdminClient();

  try {
    const {error} = await admin.rpc("update_museum_company_history_entry", {
      p_entry_id: entryId(fd),
      p_category: requiredText(fd, "category"),
      p_title: requiredText(fd, "title"),
      p_summary: requiredText(fd, "summary"),
      p_details: optionalText(fd, "details"),
      p_occurred_on: optionalDate(fd, "occurredOn"),
      p_era_label: optionalText(fd, "eraLabel"),
      p_source_label: optionalText(fd, "sourceLabel"),
      p_source_reference: optionalText(fd, "sourceReference"),
      p_actor_id: user.id,
    });

    if (error) throw error;
  } catch (error) {
    redirect(
      url(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to update curated history entry.",
      ),
    );
  }

  refreshMuseum();
  redirect(url("message", "Curated history entry updated."));
}

export async function setHistoryPublicationAction(fd: FormData) {
  const user = await requireOperationsConsoleAdmin();
  const admin = createAdminClient();
  const publish = fd.get("publish") === "true";

  try {
    const {error} = await admin.rpc(
      "set_museum_company_history_publication",
      {
        p_entry_id: entryId(fd),
        p_publish: publish,
        p_actor_id: user.id,
      },
    );

    if (error) throw error;
  } catch (error) {
    redirect(
      url(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to change history publication state.",
      ),
    );
  }

  refreshMuseum();

  const successMessage = publish
    ? "History entry published to the Airline Museum."
    : "History entry returned to Draft.";

  redirect(url("message", successMessage));
}
