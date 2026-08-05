import assert from "node:assert/strict";
import test from "node:test";
import {
  EventContractError,
  EventContractRegistry,
  FLIGHT_EVENT_TYPES,
  createEvent,
  registerFlightEventContracts,
} from "../src";

function validFlightPayload() {
  return {
    bookingId: "18ca0c5a-c1f9-47e4-8c37-f753e7236e48",
    routeId: "6b7db1d6-e942-4bbb-b0e5-b1359b2ec8b9",
    flightNumber: "KVA101",
    pilotId: "0998ace1-0d52-438a-9028-73bca15c1049",
    aircraftId: null,
    status: "booked",
  };
}

test("registers every flight integration contract", () => {
  const registry = registerFlightEventContracts(new EventContractRegistry());

  assert.ok(registry.get(FLIGHT_EVENT_TYPES.booked, 1));
  assert.ok(registry.get(FLIGHT_EVENT_TYPES.completed, 1));
  assert.ok(registry.get(FLIGHT_EVENT_TYPES.pirepCreated, 1));
});

test("accepts a valid flight.booked event", () => {
  const registry = registerFlightEventContracts(new EventContractRegistry());
  const event = createEvent({
    eventType: FLIGHT_EVENT_TYPES.booked,
    aggregateType: "flight",
    aggregateId: "18ca0c5a-c1f9-47e4-8c37-f753e7236e48",
    payload: validFlightPayload(),
  });

  assert.doesNotThrow(() => registry.assert(event));
});

test("rejects an invalid flight payload", () => {
  const registry = registerFlightEventContracts(new EventContractRegistry());
  const event = createEvent({
    eventType: FLIGHT_EVENT_TYPES.booked,
    aggregateType: "flight",
    aggregateId: "invalid",
    payload: {flightNumber: "KVA101"},
  });

  assert.throws(() => registry.assert(event), EventContractError);
});
