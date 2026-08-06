import type {
  FlightReplay,
  ReplayAnomaly,
  ReplayCheckpoint,
  ReplayEvent,
  ReplayFlightStatus,
} from "./types";

const statusByEvent: Record<string, ReplayFlightStatus> = {
  "flight.booked": "booked",
  "flight.boarding_started": "boarding",
  "flight.pushback_started": "departed",
  "flight.takeoff_recorded": "enroute",
  "flight.landing_recorded": "landed",
  "flight.completed": "completed",
};

const statusOrder: Record<ReplayFlightStatus, number> = {
  unknown: 0,
  booked: 1,
  boarding: 2,
  departed: 3,
  enroute: 4,
  landed: 5,
  completed: 6,
};

function stringValue(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function buildFlightReplay(events: ReplayEvent[]): FlightReplay {
  const sorted = [...events].sort((a, b) => {
    if (
      typeof a.streamPosition === "number" &&
      typeof b.streamPosition === "number"
    ) {
      return a.streamPosition - b.streamPosition;
    }

    const byTime =
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();

    if (byTime !== 0) return byTime;

    const phaseOrder: Record<string, number> = {
      "flight.booked": 10,
      "aircraft.assigned": 20,
      "dispatch.created": 30,
      "flight.boarding_started": 40,
      "flight.pushback_started": 50,
      "flight.takeoff_recorded": 60,
      "flight.landing_recorded": 70,
      "flight.completed": 80,
      "pirep.draft_created": 90,
      "pirep.created": 100,
    };

    const byPhase =
      (phaseOrder[a.eventType] ?? 1000) -
      (phaseOrder[b.eventType] ?? 1000);

    return byPhase !== 0 ? byPhase : a.id.localeCompare(b.id);
  });

  const anomalies: ReplayAnomaly[] = [];
  const checkpoints: ReplayCheckpoint[] = [];
  let status: ReplayFlightStatus = "unknown";
  let aircraftId: string | null = null;
  let dispatchId: string | null = null;
  let pirepId: string | null = null;
  let previousTime = Number.NEGATIVE_INFINITY;

  for (const event of events) {
    const time = new Date(event.occurredAt).getTime();
    if (Number.isFinite(time) && time < previousTime) {
      anomalies.push({
        code: "non_monotonic_time",
        message: "The supplied event stream is not in chronological order.",
        eventId: event.id,
      });
    }
    previousTime = Number.isFinite(time) ? time : previousTime;
  }

  if (!sorted.some((event) => event.eventType === "flight.booked")) {
    anomalies.push({
      code: "missing_flight_booked",
      message: "The replay has no flight.booked origin event.",
    });
  }

  const correlations = new Set(
    sorted
      .map((event) => event.correlationId)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  );

  if (correlations.size > 1) {
    anomalies.push({
      code: "multiple_correlations",
      message: "The flight lifecycle contains more than one correlation ID.",
    });
  }

  sorted.forEach((event, index) => {
    if (index === 0) return;

    const expectedCausationId = sorted[index - 1]?.id;
    if (!event.causationId) {
      anomalies.push({
        code: "missing_causation",
        message: `The event ${event.eventType} has no causation link.`,
        eventId: event.id,
      });
    } else if (event.causationId !== expectedCausationId) {
      anomalies.push({
        code: "unexpected_causation",
        message: `The event ${event.eventType} does not point to the preceding flight event.`,
        eventId: event.id,
      });
    }
  });

  for (const event of sorted) {
    const nextStatus = statusByEvent[event.eventType];

    if (nextStatus) {
      if (statusOrder[nextStatus] < statusOrder[status]) {
        anomalies.push({
          code: "status_regression",
          message: `The event ${event.eventType} moves the replay backwards from ${status} to ${nextStatus}.`,
          eventId: event.id,
        });
      } else {
        status = nextStatus;
      }
    }

    aircraftId =
      stringValue(event.payload, "aircraftId") ?? aircraftId;
    dispatchId =
      stringValue(event.payload, "dispatchId") ?? dispatchId;
    pirepId =
      stringValue(event.payload, "pirepId") ?? pirepId;

    checkpoints.push({
      eventId: event.id,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      status,
      aircraftId,
      dispatchId,
      pirepId,
    });
  }

  return {
    status,
    aircraftId,
    dispatchId,
    pirepId,
    checkpoints,
    anomalies,
  };
}

export function compareReplayWithProjection(
  replay: FlightReplay,
  projectionStatus: string | null | undefined,
): ReplayAnomaly[] {
  if (!projectionStatus || replay.status === projectionStatus) {
    return replay.anomalies;
  }

  return [
    ...replay.anomalies,
    {
      code: "projection_status_mismatch",
      message: `Replay status ${replay.status} does not match projection status ${projectionStatus}.`,
    },
  ];
}
