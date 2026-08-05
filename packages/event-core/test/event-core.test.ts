import assert from "node:assert/strict";
import test from "node:test";
import {
  DuplicateEventError,
  EventRuntime,
  InMemoryEventBus,
  InMemoryEventStore,
  InMemoryProcessingLog,
  createEvent,
  createIdempotentHandler,
} from "../src";

test("creates a versioned event with correlation data", () => {
  const event = createEvent({
    eventType: "flight.booked",
    aggregateType: "flight",
    aggregateId: "flight_1",
    payload: { flightNumber: "KVA101" },
  });

  assert.equal(event.eventVersion, 1);
  assert.equal(event.correlationId, event.id);
  assert.equal(event.payload.flightNumber, "KVA101");
});

test("stores and publishes an event", async () => {
  const store = new InMemoryEventStore();
  const bus = new InMemoryEventBus();
  const runtime = new EventRuntime(store, bus);
  const received: string[] = [];

  bus.subscribe("flight.booked", (event) => {
    received.push(event.id);
  });

  const event = createEvent({
    eventType: "flight.booked",
    aggregateType: "flight",
    aggregateId: "flight_2",
    payload: {},
  });

  await runtime.emit(event);

  assert.deepEqual(received, [event.id]);
  assert.equal((await store.query({ aggregateId: "flight_2" })).length, 1);
});

test("rejects duplicate event IDs", async () => {
  const store = new InMemoryEventStore();
  const event = createEvent({
    eventType: "pilot.created",
    aggregateType: "pilot",
    aggregateId: "pilot_1",
    payload: {},
  });

  await store.append(event);
  await assert.rejects(() => store.append(event), DuplicateEventError);
});

test("idempotent handler processes a delivered event once", async () => {
  const log = new InMemoryProcessingLog();
  let calls = 0;
  const handler = createIdempotentHandler(
    "career.projector",
    log,
    async () => {
      calls += 1;
    },
  );

  const event = createEvent({
    eventType: "flight.completed",
    aggregateType: "flight",
    aggregateId: "flight_3",
    payload: {},
  });

  await handler(event);
  await handler(event);

  assert.equal(calls, 1);
  assert.equal((await log.get(event.id, "career.projector"))?.status, "processed");
});
