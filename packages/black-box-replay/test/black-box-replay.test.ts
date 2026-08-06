import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFlightReplay,
  compareReplayWithProjection,
  type ReplayEvent,
} from "../src";

const correlationId = "correlation-1";

function event(
  id: string,
  eventType: string,
  minute: number,
  payload: Record<string, unknown> = {},
  causationId: string | null = null,
  correlation = correlationId,
): ReplayEvent {
  return {
    id,
    eventType,
    occurredAt: `2026-08-05T10:${String(minute).padStart(2, "0")}:00.000Z`,
    payload,
    correlationId: correlation,
    causationId,
  };
}

test("reconstructs a complete linked flight lifecycle", () => {
  const replay = buildFlightReplay([
    event("1", "flight.booked", 0),
    event("2", "flight.boarding_started", 5, {}, "1"),
    event("3", "flight.pushback_started", 10, {}, "2"),
    event("4", "flight.takeoff_recorded", 15, {}, "3"),
    event("5", "flight.landing_recorded", 40, {}, "4"),
    event("6", "flight.completed", 45, {}, "5"),
  ]);

  assert.equal(replay.status, "completed");
  assert.equal(replay.anomalies.length, 0);
});

test("detects multiple correlations", () => {
  const replay = buildFlightReplay([
    event("1", "flight.booked", 0),
    event("2", "flight.completed", 30, {}, "1", "correlation-2"),
  ]);

  assert.equal(
    replay.anomalies.some(
      (anomaly) => anomaly.code === "multiple_correlations",
    ),
    true,
  );
});

test("detects missing causation after the origin", () => {
  const replay = buildFlightReplay([
    event("1", "flight.booked", 0),
    event("2", "flight.completed", 30),
  ]);

  assert.equal(
    replay.anomalies.some(
      (anomaly) => anomaly.code === "missing_causation",
    ),
    true,
  );
});

test("detects unexpected causation", () => {
  const replay = buildFlightReplay([
    event("1", "flight.booked", 0),
    event("2", "flight.boarding_started", 5, {}, "1"),
    event("3", "flight.completed", 30, {}, "1"),
  ]);

  assert.equal(
    replay.anomalies.some(
      (anomaly) => anomaly.code === "unexpected_causation",
    ),
    true,
  );
});

test("detects a projection mismatch", () => {
  const replay = buildFlightReplay([
    event("1", "flight.booked", 0),
    event("2", "flight.completed", 30, {}, "1"),
  ]);

  const anomalies = compareReplayWithProjection(replay, "landed");

  assert.equal(
    anomalies.some(
      (anomaly) => anomaly.code === "projection_status_mismatch",
    ),
    true,
  );
});


test("uses stream position when transaction timestamps are identical", () => {
  const sameTime = "2026-08-05T10:00:00.000Z";
  const replay = buildFlightReplay([
    {
      id: "dispatch",
      streamPosition: 3,
      eventType: "dispatch.created",
      occurredAt: sameTime,
      payload: {},
      correlationId,
      causationId: "aircraft",
    },
    {
      id: "booked",
      streamPosition: 1,
      eventType: "flight.booked",
      occurredAt: sameTime,
      payload: {},
      correlationId,
      causationId: null,
    },
    {
      id: "aircraft",
      streamPosition: 2,
      eventType: "aircraft.assigned",
      occurredAt: sameTime,
      payload: {},
      correlationId,
      causationId: "booked",
    },
  ]);

  assert.deepEqual(
    replay.checkpoints.map((checkpoint) => checkpoint.eventId),
    ["booked", "aircraft", "dispatch"],
  );
  assert.equal(replay.anomalies.length, 0);
});
