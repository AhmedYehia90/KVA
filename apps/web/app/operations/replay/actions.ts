"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createAdminClient} from "@/lib/supabase/admin";
import {requireOperationsConsoleAdmin} from "@/lib/operations/console-auth";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function replayUrl(
  bookingId: string,
  kind: "message" | "error",
  value: string
) {
  return `/operations/replay?bookingId=${encodeURIComponent(
    bookingId
  )}&${kind}=${encodeURIComponent(value)}`;
}

export async function addBlackBoxReplayNoteAction(formData: FormData) {
  const user = await requireOperationsConsoleAdmin();
  const bookingId = formData.get("bookingId");
  const note = formData.get("note");

  if (
    typeof bookingId !== "string" ||
    !uuidPattern.test(bookingId)
  ) {
    redirect("/operations/replay?error=Invalid%20booking%20ID.");
  }

  if (
    typeof note !== "string" ||
    note.trim().length < 1 ||
    note.trim().length > 2000
  ) {
    redirect(
      replayUrl(
        bookingId,
        "error",
        "Replay note must contain between 1 and 2000 characters."
      )
    );
  }

  const admin = createAdminClient();
  const {data, error} = await admin.rpc("add_black_box_replay_note", {
    p_booking_id: bookingId,
    p_author_user_id: user.id,
    p_author_email: user.email ?? "unknown",
    p_note: note.trim()
  });

  await admin.from("operations_console_audit").insert({
    actor_user_id: user.id,
    actor_email: user.email ?? "unknown",
    action: "add_black_box_note",
    status: error ? "failed" : "succeeded",
    input: {
      bookingId,
      noteLength: note.trim().length
    },
    result: {
      noteId: data
    },
    error: error?.message ?? null
  });

  revalidatePath("/operations/replay");
  revalidatePath("/operations/events");

  if (error) {
    redirect(replayUrl(bookingId, "error", error.message));
  }

  redirect(
    replayUrl(
      bookingId,
      "message",
      "Investigation note added to the replay."
    )
  );
}
