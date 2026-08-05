# Event Bus

The Event Bus routes versioned KVA domain events to registered consumers.

## v1.0 guarantees
- Exact event-type subscriptions
- Global subscriptions for observability
- Ordered handler execution inside one process
- Async handler support
- Unsubscribe functions

## Boundary
The in-memory bus is for application-process orchestration and testing. Durable cross-process delivery will be introduced through a queue adapter in a later pack.
