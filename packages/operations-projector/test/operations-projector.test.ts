import assert from "node:assert/strict";
import test from "node:test";
import {createEvent} from "@kva/event-core";
import {OperationsProjector} from "../src";

const bookingId = "18ca0c5a-c1f9-47e4-8c37-f753e7236e48";

function flightEvent(
  eventType:
    | "flight.booked"
    | "flight.boarding_started"
    | "flight.pushback_started"
    | "flight.takeoff_recorded"
    | "flight.landing_recorded"
    | "flight.completed",
  status: "booked" | "boarding" | "departed" | "enroute" | "landed" | "completed",
) {
  return createEvent({
    eventType,
    organizationId: "kalabsha-airlines",
    aggregateType: "flight",
    aggregateId: bookingId,
    payload: {
      bookingId,
      routeId: "6b7db1d6-e942-4bbb-b0e5-b1359b2ec8b9",
      flightNumber: "KVA101",
      pilotId: "0998ace1-0d52-438a-9028-73bca15c1049",
      aircraftId: null,
      status,
    },
  });
}

test("builds an operations projection from a flight lifecycle", () => {
  const projector = new OperationsProjector();

  projector.project(flightEvent("flight.booked", "booked"));
  projector.project(flightEvent("flight.boarding_started", "boarding"));
  projector.project(flightEvent("flight.pushback_started", "departed"));
  projector.project(flightEvent("flight.takeoff_recorded", "enroute"));
  projector.project(flightEvent("flight.landing_recorded", "landed"));
  const projection = projector.project(
    flightEvent("flight.completed", "completed"),
  );

  assert.equal(projection?.bookingId, bookingId);
  assert.equal(projection?.flightNumber, "KVA101");
  assert.equal(projection?.status, "completed");
  assert.ok(projection?.startedAt);
  assert.ok(projection?.completedAt);
  assert.equal(projection?.version, 6);
});

test("projects aircraft and dispatch events into the same flight", () => {
  const projector = new OperationsProjector();
  const booked = flightEvent("flight.booked", "booked");
  projector.project(booked);

  projector.project(
    createEvent({
      eventType: "aircraft.assigned",
      organizationId: "kalabsha-airlines",
      aggregateType: "aircraft",
      aggregateId: "84c6ca31-ddbb-4308-b83e-61e94ac5d483",
      correlationId: booked.correlationId,
      causationId: booked.id,
      payload: {
        bookingId,
        routeId: "6b7db1d6-e942-4bbb-b0e5-b1359b2ec8b9",
        pilotId: "0998ace1-0d52-438a-9028-73bca15c1049",
        aircraftId: "84c6ca31-ddbb-4308-b83e-61e94ac5d483",
      },
    }),
  );

  const projection = projector.project(
    createEvent({
      eventType: "dispatch.created",
      organizationId: "kalabsha-airlines",
      aggregateType: "dispatch",
      aggregateId: "6dcc6903-980c-48fb-9b61-f34701f9da83",
      correlationId: booked.correlationId,
      payload: {
        bookingId,
        routeId: "6b7db1d6-e942-4bbb-b0e5-b1359b2ec8b9",
        flightNumber: "KVA101",
        dispatchId: "6dcc6903-980c-48fb-9b61-f34701f9da83",
      },
    }),
  );

  assert.equal(
    projection?.aircraftId,
    "84c6ca31-ddbb-4308-b83e-61e94ac5d483",
  );
  assert.equal(
    projection?.dispatchId,
    "6dcc6903-980c-48fb-9b61-f34701f9da83",
  );
});

test("is idempotent for duplicate event delivery", () => {
  const projector = new OperationsProjector();
  const event = flightEvent("flight.booked", "booked");

  const first = projector.project(event);
  const second = projector.project(event);

  assert.equal(first?.version, 1);
  assert.equal(second?.version, 1);
  assert.equal(projector.list().length, 1);
});

test("ignores unrelated events", () => {
  const projector = new OperationsProjector();
  const result = projector.project(
    createEvent({
      eventType: "pilot.created",
      aggregateType: "pilot",
      aggregateId: "pilot_1",
      payload: {},
    }),
  );

  assert.equal(result, undefined);
  assert.equal(projector.list().length, 0);
});
