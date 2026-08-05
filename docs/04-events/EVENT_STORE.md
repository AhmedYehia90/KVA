# Event Store

The KVA Event Store is durable, append-only, organization-aware, and replay-ready.

## Tables
- `platform_events`: immutable domain event envelopes
- `event_processing_log`: idempotency and consumer execution state

## Rules
- Existing events are never edited as business corrections.
- Corrections are represented by new events.
- Event IDs are globally unique UUIDs.
- Aggregate, correlation, and causation identifiers are indexed.
- Consumers use `(event_id, consumer_name)` as the idempotency key.
