"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requireOperationsConsoleAdmin} from "@/lib/operations/console-auth";
import {createAdminClient} from "@/lib/supabase/admin";

function adminUrl(kind:"message" | "error", value:string) {
  return `/operations/global-events?${kind}=${encodeURIComponent(value)}`;
}

function requiredString(formData:FormData, key:string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required`);
  }

  return value.trim();
}

function utcDate(value:string) {
  const parsed = new Date(
    value.endsWith("Z") ? value : `${value}:00Z`
  );

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid event date");
  }

  return parsed.toISOString();
}

export async function createGlobalEventAction(formData:FormData) {
  const user = await requireOperationsConsoleAdmin();
  const admin = createAdminClient();

  try {
    const code = requiredString(formData, "code").toUpperCase();
    const slug = requiredString(formData, "slug").toLowerCase();
    const title = requiredString(formData, "title");
    const description = requiredString(formData, "description");
    const category =
      (formData.get("category") as string | null)?.trim() ||
      "global_campaign";
    const badgeName = requiredString(formData, "badgeName");
    const startsAt = utcDate(requiredString(formData, "startsAt"));
    const endsAt = utcDate(requiredString(formData, "endsAt"));
    const registrationOpensAt = utcDate(
      requiredString(formData, "registrationOpensAt")
    );
    const registrationClosesAt = utcDate(
      requiredString(formData, "registrationClosesAt")
    );
    const requiredFlightsValue = Number(
      formData.get("requiredFlights") ?? 1
    );

    if (
      !Number.isFinite(requiredFlightsValue) ||
      requiredFlightsValue < 1
    ) {
      throw new Error("Required flights must be at least 1.");
    }

    const requiredFlights = Math.floor(requiredFlightsValue);
    const routeIds = formData
      .getAll("routeId")
      .filter((value): value is string => typeof value === "string");

    if (!routeIds.length) {
      throw new Error("Select at least one event route.");
    }

    const {error} = await admin.rpc("create_global_aviation_event", {
      p_code: code,
      p_slug: slug,
      p_title: title,
      p_description: description,
      p_category: category,
      p_starts_at: startsAt,
      p_ends_at: endsAt,
      p_registration_opens_at: registrationOpensAt,
      p_registration_closes_at: registrationClosesAt,
      p_required_flights: requiredFlights,
      p_badge_name: badgeName,
      p_route_ids: routeIds,
      p_actor_id: user.id
    });

    if (error) throw error;
  } catch (error) {
    redirect(
      adminUrl(
        "error",
        error instanceof Error ? error.message : "Unable to create event."
      )
    );
  }

  revalidatePath("/operations/global-events");
  revalidatePath("/pilot/events");
  redirect(adminUrl("message", "Global aviation event published."));
}

export async function setGlobalEventLifecycleAction(
  formData:FormData
) {
  const user = await requireOperationsConsoleAdmin();
  const admin = createAdminClient();
  const eventId = formData.get("eventId");
  const status = formData.get("status");

  if (typeof eventId !== "string" || !eventId) {
    redirect(adminUrl("error", "A valid event is required."));
  }

  if (
    status !== "published" &&
    status !== "archived" &&
    status !== "cancelled"
  ) {
    redirect(adminUrl("error", "A valid lifecycle status is required."));
  }

  const {error} = await admin.rpc(
    "set_global_aviation_event_lifecycle",
    {
      p_event_id: eventId,
      p_status: status,
      p_actor_id: user.id
    }
  );

  if (error) {
    redirect(adminUrl("error", error.message));
  }

  revalidatePath("/operations/global-events");
  revalidatePath("/pilot/events");
  redirect(
    adminUrl(
      "message",
      `Global aviation event changed to ${status}.`
    )
  );
}
