"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

function airbotUrl(kind: "message" | "error", value: string) {
  return `/pilot/airbot?${kind}=${encodeURIComponent(value)}`;
}

export async function askLivingAirbotAction(formData: FormData) {
  const sessionId = formData.get("sessionId");
  const intent = formData.get("intent");
  const message = formData.get("message");

  if (typeof sessionId !== "string" || !sessionId) {
    redirect(airbotUrl("error", "A valid Airbot session is required."));
  }

  if (
    intent !== "briefing" &&
    intent !== "readiness" &&
    intent !== "aircraft" &&
    intent !== "next_step" &&
    intent !== "custom"
  ) {
    redirect(airbotUrl("error", "A valid Airbot intent is required."));
  }

  if (
    typeof message === "string" &&
    message.length > 2000
  ) {
    redirect(
      airbotUrl(
        "error",
        "Airbot messages cannot exceed 2000 characters."
      )
    );
  }

  const supabase = await createClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  const {error} = await supabase.rpc("ask_living_airbot", {
    p_session_id: sessionId,
    p_intent: intent,
    p_message:
      typeof message === "string" && message.trim()
        ? message.trim()
        : null
  });

  revalidatePath("/pilot/airbot");

  if (error) {
    redirect(airbotUrl("error", error.message));
  }

  redirect(
    airbotUrl(
      "message",
      "Living Airbot updated the dispatch conversation."
    )
  );
}
