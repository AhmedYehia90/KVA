import {createAdminClient} from "@/lib/supabase/admin";
import {isOperationsConsoleAdminEmail} from "@/lib/operations/console-auth";
import {createClient} from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: {params: Promise<{bookingId: string}>}
) {
  const {bookingId} = await context.params;

  if (!uuidPattern.test(bookingId)) {
    return new Response("Not found", {status: 404});
  }

  const supabase = await createClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user || !isOperationsConsoleAdminEmail(user.email)) {
    return new Response("Not found", {status: 404});
  }

  const admin = createAdminClient();
  const {data, error} = await admin.rpc("get_flight_black_box_replay", {
    p_booking_id: bookingId
  });

  if (error) {
    await admin.from("operations_console_audit").insert({
      actor_user_id: user.id,
      actor_email: user.email ?? "unknown",
      action: "export_black_box_replay",
      status: "failed",
      input: {bookingId},
      result: {},
      error: error.message
    });

    return new Response(error.message, {status: 500});
  }

  if (!data) {
    return new Response("Not found", {status: 404});
  }

  const replay = data as unknown as {
    projection?: {flightNumber?: string | null};
    integrity?: {eventCount?: number};
  };

  const {error: accessError} = await admin.rpc(
    "record_black_box_replay_access",
    {
      p_booking_id: bookingId,
      p_actor_user_id: user.id,
      p_actor_email: user.email ?? "unknown",
      p_action: "exported"
    }
  );

  await admin.from("operations_console_audit").insert({
    actor_user_id: user.id,
    actor_email: user.email ?? "unknown",
    action: "export_black_box_replay",
    status: accessError ? "failed" : "succeeded",
    input: {bookingId},
    result: {
      eventCount: replay.integrity?.eventCount ?? 0
    },
    error: accessError?.message ?? null
  });

  const safeFlightNumber = (replay.projection?.flightNumber ?? "flight")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "");

  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition":
        `attachment; filename="${safeFlightNumber || "flight"}-${bookingId}-black-box.json"`,
      "Cache-Control": "no-store"
    }
  });
}
