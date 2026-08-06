"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

function companionUrl(kind: "message" | "error", value: string) {
  return `/pilot/companion?${kind}=${encodeURIComponent(value)}`;
}

export async function updateCompanionPreferencesAction(
  formData: FormData
) {
  const tone = formData.get("tone");
  const detailLevel = formData.get("detailLevel");

  if (
    tone !== "supportive" &&
    tone !== "professional" &&
    tone !== "direct"
  ) {
    redirect(companionUrl("error", "Invalid companion tone."));
  }

  if (
    detailLevel !== "concise" &&
    detailLevel !== "standard" &&
    detailLevel !== "detailed"
  ) {
    redirect(companionUrl("error", "Invalid detail level."));
  }

  const supabase = await createClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  const {error} = await supabase.rpc("update_companion_preferences", {
    p_tone: tone,
    p_detail_level: detailLevel
  });

  revalidatePath("/pilot/companion");

  if (error) {
    redirect(companionUrl("error", error.message));
  }

  redirect(
    companionUrl(
      "message",
      "Companion preferences updated for future debriefs."
    )
  );
}

export async function acknowledgeCompanionDebriefAction(
  formData: FormData
) {
  const debriefId = formData.get("debriefId");

  if (typeof debriefId !== "string" || !debriefId) {
    redirect(companionUrl("error", "A valid debrief is required."));
  }

  const supabase = await createClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  const {error} = await supabase.rpc(
    "acknowledge_companion_debrief",
    {
      p_debrief_id: debriefId
    }
  );

  revalidatePath("/pilot/companion");

  if (error) {
    redirect(companionUrl("error", error.message));
  }

  redirect(
    companionUrl(
      "message",
      "Debrief acknowledged. The focus items remain available for review."
    )
  );
}
