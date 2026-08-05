import type {KvaEvent} from "@kva/event-core";
import type {
  FlightEventPayload,
  OperationsFlightProjection,
  OperationsFlightStatus,
} from "./types";

export const OPERATIONS_PROJECTOR_CONSUMER = "operations.projector";

const supportedEvents = new Set([
  "flight.booked",
  "aircraft.assigned",
  "dispatch.created",
  "flight.boarding_started",
  "flight.pushback_started",
  "flight.takeoff_recorded",
  "flight.landing_recorded",
  "flight.completed",
  "pirep.created",
]);

function payloadOf(event: KvaEvent): FlightEventPayload | undefined {
  if (
    typeof event.payload !== "object" ||
    event.payload === null ||
    Array.isArray(event.payload)
  ) {
    return undefined;
  }

  const payload = event.payload as Record<string, unknown>;
  if (typeof payload.bookingId !== "string" || payload.bookingId === "") {
    return undefined;
  }

  return payload as unknown as FlightEventPayload;
}

function statusFor(event: KvaEvent, payload: FlightEventPayload): OperationsFlightStatus {
  if (payload.status) return payload.status;

  switch (event.eventType) {
    case "flight.booked":
      return "booked";
    case "flight.boarding_started":
      return "boarding";
    case "flight.pushback_started":
      return "departed";
    case "flight.takeoff_recorded":
      return "enroute";
    case "flight.landing_recorded":
      return "landed";
    case "flight.completed":
      return "completed";
    default:
      return "booked";
  }
}

export class OperationsProjector {
  private readonly projections = new Map<string, OperationsFlightProjection>();
  private readonly processedEvents = new Set<string>();

  project(event: KvaEvent): OperationsFlightProjection | undefined {
    if (!supportedEvents.has(event.eventType)) return undefined;
    if (this.processedEvents.has(event.id)) {
      const payload = payloadOf(event);
      return payload ? this.projections.get(payload.bookingId) : undefined;
    }

    const payload = payloadOf(event);
    if (!payload) return undefined;

    const previous = this.projections.get(payload.bookingId);
    const next: OperationsFlightProjection = {
      bookingId: payload.bookingId,
      status: previous?.status ?? statusFor(event, payload),
      lastEventId: event.id,
      lastEventType: event.eventType,
      lastEventAt: event.occurredAt,
      version: (previous?.version ?? 0) + 1,
      ...(previous?.organizationId
        ? {organizationId: previous.organizationId}
        : event.organizationId
          ? {organizationId: event.organizationId}
          : {}),
      ...(previous?.routeId
        ? {routeId: previous.routeId}
        : payload.routeId
          ? {routeId: payload.routeId}
          : {}),
      ...(previous?.flightNumber
        ? {flightNumber: previous.flightNumber}
        : payload.flightNumber
          ? {flightNumber: payload.flightNumber}
          : {}),
      ...(previous?.pilotId
        ? {pilotId: previous.pilotId}
        : payload.pilotId
          ? {pilotId: payload.pilotId}
          : {}),
      ...(previous?.aircraftId !== undefined
        ? {aircraftId: previous.aircraftId}
        : payload.aircraftId !== undefined
          ? {aircraftId: payload.aircraftId}
          : {}),
      ...(previous?.dispatchId ? {dispatchId: previous.dispatchId} : {}),
      ...(previous?.pirepId ? {pirepId: previous.pirepId} : {}),
      ...(previous?.startedAt ? {startedAt: previous.startedAt} : {}),
      ...(previous?.completedAt ? {completedAt: previous.completedAt} : {}),
    };

    if (event.eventType === "aircraft.assigned" && payload.aircraftId) {
      next.aircraftId = payload.aircraftId;
    }

    if (event.eventType === "dispatch.created" && payload.dispatchId) {
      next.dispatchId = payload.dispatchId;
    }

    if (event.eventType === "pirep.created" && payload.pirepId) {
      next.pirepId = payload.pirepId;
    }

    if (event.eventType.startsWith("flight.")) {
      next.status = statusFor(event, payload);
    }

    if (event.eventType === "flight.boarding_started" && !next.startedAt) {
      next.startedAt = event.occurredAt;
    }

    if (event.eventType === "flight.completed") {
      next.completedAt = event.occurredAt;
    }

    this.processedEvents.add(event.id);
    this.projections.set(payload.bookingId, next);
    return next;
  }

  get(bookingId: string): OperationsFlightProjection | undefined {
    return this.projections.get(bookingId);
  }

  list(): OperationsFlightProjection[] {
    return Array.from(this.projections.values()).sort((a, b) =>
      b.lastEventAt.localeCompare(a.lastEventAt),
    );
  }
}
