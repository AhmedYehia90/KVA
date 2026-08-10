"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

function eventsUrl(
  slug: string | null,
  kind: "message" | "error",
  value: string
) {
  const base = slug ? `/pilot/events/${slug}` : "/pilot/events";
  return `${base}?${kind}=${encodeURIComponent(value)}`;
}

async function requirePilot() {
  const supabase = await createClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  return {supabase, user};
}

export async function joinGlobalEventAction(formData: FormData) {
  const eventId = formData.get("eventId");
  const slug = formData.get("slug");

  if (typeof eventId !== "string" || !eventId) {
    redirect(eventsUrl(null, "error", "A valid global event is required."));
  }

  const {supabase} = await requirePilot();
  const {error} = await supabase.rpc("join_global_aviation_event", {
    p_event_id: eventId
  });

  revalidatePath("/pilot/events");

  if (typeof slug === "string" && slug) {
    revalidatePath(`/pilot/events/${slug}`);
  }

  if (error) {
    redirect(
      eventsUrl(
        typeof slug === "string" ? slug : null,
        "error",
        error.message
      )
    );
  }

  redirect(
    eventsUrl(
      typeof slug === "string" ? slug : null,
      "message",
      "You joined the global aviation event."
    )
  );
}

export async function withdrawGlobalEventAction(formData: FormData) {
  const eventId = formData.get("eventId");
  const slug = formData.get("slug");

  if (typeof eventId !== "string" || !eventId) {
    redirect(eventsUrl(null, "error", "A valid global event is required."));
  }

  const {supabase} = await requirePilot();
  const {error} = await supabase.rpc("withdraw_global_aviation_event", {
    p_event_id: eventId
  });

  revalidatePath("/pilot/events");

  if (typeof slug === "string" && slug) {
    revalidatePath(`/pilot/events/${slug}`);
  }

  if (error) {
    redirect(
      eventsUrl(
        typeof slug === "string" ? slug : null,
        "error",
        error.message
      )
    );
  }

  redirect(
    eventsUrl(
      typeof slug === "string" ? slug : null,
      "message",
      "You withdrew from the global aviation event."
    )
  );
}
