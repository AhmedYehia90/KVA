import "server-only";

import {createAdminClient} from "@/lib/supabase/admin";

export type EventConsoleFilters = {
  eventType?: string;
  status?: string;
};

type PlatformEvent = {
  id: string;
  event_type: string;
  event_version: number;
  organization_id: string | null;
  aggregate_type: string;
  aggregate_id: string;
  actor_id: string | null;
  correlation_id: string;
  causation_id: string | null;
  occurred_at: string;
  payload: unknown;
  metadata: unknown;
};

type ProcessingLog = {
  id: string;
  event_id: string;
  consumer_name: string;
  status: string;
  attempts: number;
  last_error: string | null;
  processed_at: string | null;
  updated_at: string;
};

type Projection = {
  booking_id: string;
  flight_number: string | null;
  status: string;
  pilot_id: string | null;
  aircraft_id: string | null;
  dispatch_id: string | null;
  pirep_id: string | null;
  last_event_type: string;
  last_event_at: string;
  projection_version: number;
};

type AuditEntry = {
  id: string;
  actor_user_id: string | null;
  actor_email: string;
  action: string;
  status: string;
  input: unknown;
  result: unknown;
  error: string | null;
  created_at: string;
};

function countValue(value: number | null): number {
  return typeof value === "number" ? value : 0;
}

export async function getEventConsoleData(
  filters: EventConsoleFilters = {}
) {
  const admin = createAdminClient();
  const eventType = filters.eventType?.trim();
  const status = filters.status?.trim().toUpperCase();

  let eventsQuery = admin
    .from("platform_events")
    .select(
      "id,event_type,event_version,organization_id,aggregate_type,aggregate_id,actor_id,correlation_id,causation_id,occurred_at,payload,metadata"
    )
    .order("occurred_at", {ascending: false})
    .limit(75);

  if (eventType) {
    eventsQuery = eventsQuery.eq("event_type", eventType);
  }

  let processingQuery = admin
    .from("event_processing_log")
    .select(
      "id,event_id,consumer_name,status,attempts,last_error,processed_at,updated_at"
    )
    .eq("consumer_name", "operations.projector")
    .order("updated_at", {ascending: false})
    .limit(75);

  if (status && status !== "ALL") {
    processingQuery = processingQuery.eq("status", status);
  }

  const [
    eventsResult,
    processingResult,
    projectionResult,
    auditResult,
    totalEventsResult,
    processedResult,
    failedResult,
    pendingResult,
    projectionsCountResult
  ] = await Promise.all([
    eventsQuery,
    processingQuery,
    admin
      .from("operations_flight_projection")
      .select(
        "booking_id,flight_number,status,pilot_id,aircraft_id,dispatch_id,pirep_id,last_event_type,last_event_at,projection_version"
      )
      .order("last_event_at", {ascending: false})
      .limit(40),
    admin
      .from("operations_console_audit")
      .select(
        "id,actor_user_id,actor_email,action,status,input,result,error,created_at"
      )
      .order("created_at", {ascending: false})
      .limit(30),
    admin
      .from("platform_events")
      .select("*", {count: "exact", head: true}),
    admin
      .from("event_processing_log")
      .select("*", {count: "exact", head: true})
      .eq("consumer_name", "operations.projector")
      .eq("status", "PROCESSED"),
    admin
      .from("event_processing_log")
      .select("*", {count: "exact", head: true})
      .eq("consumer_name", "operations.projector")
      .eq("status", "FAILED"),
    admin
      .from("event_processing_log")
      .select("*", {count: "exact", head: true})
      .eq("consumer_name", "operations.projector")
      .in("status", ["PENDING", "PROCESSING"]),
    admin
      .from("operations_flight_projection")
      .select("*", {count: "exact", head: true})
  ]);

  const firstError =
    eventsResult.error ??
    processingResult.error ??
    projectionResult.error ??
    auditResult.error ??
    totalEventsResult.error ??
    processedResult.error ??
    failedResult.error ??
    pendingResult.error ??
    projectionsCountResult.error;

  if (firstError) {
    throw new Error(`Unable to load Event Console: ${firstError.message}`);
  }

  const events = (eventsResult.data ?? []) as PlatformEvent[];
  const processing = (processingResult.data ?? []) as ProcessingLog[];
  const projections = (projectionResult.data ?? []) as Projection[];
  const audit = (auditResult.data ?? []) as AuditEntry[];

  const referencedEventIds = Array.from(
    new Set(processing.map((item) => item.event_id))
  );

  let referencedEvents: PlatformEvent[] = [];

  if (referencedEventIds.length > 0) {
    const {data, error} = await admin
      .from("platform_events")
      .select(
        "id,event_type,event_version,organization_id,aggregate_type,aggregate_id,actor_id,correlation_id,causation_id,occurred_at,payload,metadata"
      )
      .in("id", referencedEventIds);

    if (error) {
      throw new Error(
        `Unable to load processing event details: ${error.message}`
      );
    }

    referencedEvents = (data ?? []) as PlatformEvent[];
  }

  const eventMap = new Map<string, PlatformEvent>();

  for (const event of [...events, ...referencedEvents]) {
    eventMap.set(event.id, event);
  }

  return {
    stats: {
      totalEvents: countValue(totalEventsResult.count),
      processed: countValue(processedResult.count),
      failed: countValue(failedResult.count),
      pending: countValue(pendingResult.count),
      projections: countValue(projectionsCountResult.count)
    },
    events,
    processing: processing.map((item) => ({
      ...item,
      event: eventMap.get(item.event_id) ?? null
    })),
    projections,
    audit
  };
}
