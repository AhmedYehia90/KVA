"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

function mentorUrl(kind: "message" | "error", value: string) {
  return `/pilot/mentor?${kind}=${encodeURIComponent(value)}`;
}

async function requirePilot() {
  const supabase = await createClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  return {supabase, user};
}

export async function recordMentorReflectionAction(
  formData: FormData
) {
  const sessionId = formData.get("sessionId");
  const responseType = formData.get("responseType");
  const note = formData.get("note");

  if (typeof sessionId !== "string" || !sessionId) {
    redirect(mentorUrl("error", "A valid mentor session is required."));
  }

  if (
    responseType !== "understood" &&
    responseType !== "need_simpler" &&
    responseType !== "need_example" &&
    responseType !== "ready_to_practice" &&
    responseType !== "custom"
  ) {
    redirect(mentorUrl("error", "A valid mentor response is required."));
  }

  if (
    typeof note === "string" &&
    note.length > 2000
  ) {
    redirect(
      mentorUrl(
        "error",
        "Reflection notes cannot exceed 2000 characters."
      )
    );
  }

  const {supabase} = await requirePilot();
  const {error} = await supabase.rpc(
    "record_mentor_ai_reflection",
    {
      p_session_id: sessionId,
      p_response_type: responseType,
      p_note:
        typeof note === "string" && note.trim()
          ? note.trim()
          : null
    }
  );

  revalidatePath("/pilot/mentor");

  if (error) {
    redirect(mentorUrl("error", error.message));
  }

  redirect(
    mentorUrl(
      "message",
      "Your reflection was recorded and the mentor response is ready."
    )
  );
}

export async function createMentorGoalAction(
  formData: FormData
) {
  const sessionId = formData.get("sessionId");

  if (typeof sessionId !== "string" || !sessionId) {
    redirect(mentorUrl("error", "A valid mentor session is required."));
  }

  const {supabase} = await requirePilot();
  const {error} = await supabase.rpc("create_mentor_ai_goal", {
    p_session_id: sessionId
  });

  revalidatePath("/pilot/mentor");

  if (error) {
    redirect(mentorUrl("error", error.message));
  }

  redirect(
    mentorUrl(
      "message",
      "Mentor goal created. Future debriefs will update its progress."
    )
  );
}

export async function updateMentorGoalStatusAction(
  formData: FormData
) {
  const goalId = formData.get("goalId");
  const status = formData.get("status");

  if (typeof goalId !== "string" || !goalId) {
    redirect(mentorUrl("error", "A valid mentor goal is required."));
  }

  if (
    status !== "active" &&
    status !== "paused" &&
    status !== "completed"
  ) {
    redirect(mentorUrl("error", "A valid goal status is required."));
  }

  const {supabase} = await requirePilot();
  const {error} = await supabase.rpc(
    "set_mentor_ai_goal_status",
    {
      p_goal_id: goalId,
      p_status: status
    }
  );

  revalidatePath("/pilot/mentor");

  if (error) {
    redirect(mentorUrl("error", error.message));
  }

  redirect(
    mentorUrl(
      "message",
      `Mentor goal changed to ${status}.`
    )
  );
}
