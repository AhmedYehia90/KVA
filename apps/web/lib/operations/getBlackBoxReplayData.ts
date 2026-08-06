import "server-only";

import {createAdminClient} from "@/lib/supabase/admin";

export type BlackBoxIndexRow = {
  booking_id: string;
  organization_id: string;
  flight_number: string | null;
  status: string;
  pilot_id: string | null;
  aircraft_id: string | null;
  dispatch_id: string | null;
  pirep_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_event_id: string;
  last_event_type: string;
  last_event_at: string;
  projection_version: number;
  event_count: number;
  unhealthy_event_count: number;
  first_event_at: string | null;
  latest_source_event_at: string | null;
};

export type BlackBoxReplayEvent = {
  id: string;
  streamPosition: number;
  eventType: string;
  eventVersion: number;
  organizationId: string | null;
  aggregateType: string;
  aggregateId: string;
  actorId: string | null;
  correlationId: string;
  causationId: string | null;
  occurredAt: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  processing: {
    consumerName: string;
    status: string;
    attempts: number;
    lastError: string | null;
    processedAt: string | null;
    updatedAt: string;
  } | null;
};

export type BlackBoxReplayNote = {
  id: string;
  authorUserId: string | null;
  authorEmail: string;
  note: string;
  createdAt: string;
};

export type BlackBoxReplayData = {
  generatedAt: string;
  bookingId: string;
  organizationId: string;
  projection: {
    flightNumber: string | null;
    status: string;
    pilotId: string | null;
    aircraftId: string | null;
    dispatchId: string | null;
    pirepId: string | null;
    startedAt: string | null;
    completedAt: string | null;
    lastEventId: string;
    lastEventType: string;
    lastEventAt: string;
    projectionVersion: number;
  };
  integrity: {
    eventCount: number;
    unhealthyProcessingCount: number;
    unresolvedCausationLinks: number;
    missingCausationLinks: number;
    unexpectedCausationLinks: number;
    correlationCount: number;
    singleCorrelation: boolean;
    hasOriginEvent: boolean;
    projectionLastEventPresent: boolean;
    replayedStatus: string;
    projectionStatus: string;
    statusMatchesProjection: boolean;
    healthy: boolean;
  };
  events: BlackBoxReplayEvent[];
  notes: BlackBoxReplayNote[];
};

type ReplayActor = {
  id: string;
  email: string | null | undefined;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getBlackBoxReplayData(
  requestedBookingId?: string,
  actor?: ReplayActor
) {
  const admin = createAdminClient();

  const {data: indexData, error: indexError} = await admin
    .from("black_box_replay_index")
    .select("*")
    .eq("organization_id", "kalabsha-airlines")
    .order("last_event_at", {ascending: false})
    .limit(50);

  if (indexError) {
    throw new Error(`Unable to load Black Box Replay index: ${indexError.message}`);
  }

  const flights = (indexData ?? []) as unknown as BlackBoxIndexRow[];
  const requestedIsValid =
    typeof requestedBookingId === "string" &&
    uuidPattern.test(requestedBookingId);

  const selectedBookingId =
    requestedIsValid &&
    flights.some((flight) => flight.booking_id === requestedBookingId)
      ? requestedBookingId
      : flights[0]?.booking_id ?? null;

  if (!selectedBookingId) {
    return {
      flights,
      selectedBookingId: null,
      replay: null
    };
  }

  const {data: replayData, error: replayError} = await admin.rpc(
    "get_flight_black_box_replay",
    {
      p_booking_id: selectedBookingId
    }
  );

  if (replayError) {
    throw new Error(`Unable to load flight replay: ${replayError.message}`);
  }

  const replay = replayData as unknown as BlackBoxReplayData | null;

  if (
    replay &&
    actor &&
    requestedIsValid &&
    requestedBookingId === selectedBookingId
  ) {
    const actorEmail = actor.email ?? "unknown";

    const {error: accessError} = await admin.rpc(
      "record_black_box_replay_access",
      {
        p_booking_id: selectedBookingId,
        p_actor_user_id: actor.id,
        p_actor_email: actorEmail,
        p_action: "opened"
      }
    );

    await admin.from("operations_console_audit").insert({
      actor_user_id: actor.id,
      actor_email: actorEmail,
      action: "open_black_box_replay",
      status: accessError ? "failed" : "succeeded",
      input: {bookingId: selectedBookingId},
      result: {
        eventCount: replay.integrity.eventCount
      },
      error: accessError?.message ?? null
    });
  }

  return {
    flights,
    selectedBookingId,
    replay
  };
}
