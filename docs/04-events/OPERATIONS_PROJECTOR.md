# Operations Event Projector

## Purpose

`operations.projector` converts the durable flight event stream into a query-optimized operational read model.

## Source of truth

- Write-side truth: domain tables and `platform_events`
- Read-side projection: `operations_flight_projection`
- Consumer state: `event_processing_log`

The projection may be deleted and rebuilt from events.

## Guarantees

- Idempotent processing by `(event_id, consumer_name)`
- Chronological backfill
- Failed events remain visible and retryable
- Client sessions cannot execute projector functions
- Authenticated users may read the operational projection
- The existing `/operations` screen reads active flights from the projection

## Recovery

Trusted service-role processes can execute:

```sql
select * from public.retry_operations_projection(100);
```

A full rebuild is available through:

```sql
select public.rebuild_operations_projection();
```
