# @kva/event-core

The first executable kernel package of KVA OS.

## Capabilities
- Versioned event envelopes
- Event contract registry
- Append-only event store interface
- In-memory event store
- Exact and wildcard subscriptions
- Idempotent consumer wrapper
- Correlation and causation tracking
- Runtime orchestration

## Minimal example

```ts
import {
  EventRuntime,
  InMemoryEventBus,
  InMemoryEventStore,
  createEvent,
} from "@kva/event-core";

const runtime = new EventRuntime(
  new InMemoryEventStore(),
  new InMemoryEventBus(),
);

await runtime.emit(
  createEvent({
    eventType: "flight.booked",
    aggregateType: "flight",
    aggregateId: "flight_123",
    payload: { flightNumber: "KVA101" },
  }),
);
```
