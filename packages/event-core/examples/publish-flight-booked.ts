import {
  EventRuntime,
  InMemoryEventBus,
  InMemoryEventStore,
  createEvent,
} from "../src";

async function main(): Promise<void> {
  const store = new InMemoryEventStore();
  const bus = new InMemoryEventBus();
  const runtime = new EventRuntime(store, bus);

  bus.subscribe("flight.booked", (event) => {
    console.log("Received", event.eventType, event.aggregateId);
  });

  await runtime.emit(
    createEvent({
      eventType: "flight.booked",
      organizationId: "kalabsha-airlines",
      aggregateType: "flight",
      aggregateId: "flight_demo_001",
      actorId: "pilot_demo_001",
      payload: {
        flightNumber: "KVA101",
        originIcao: "HECA",
        destinationIcao: "OKKK",
      },
      metadata: {
        source: "event-core-example",
        privacy: "internal",
      },
    }),
  );
}

void main();
