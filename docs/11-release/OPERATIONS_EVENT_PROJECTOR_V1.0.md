# KVA Operations Event Projector v1.0

## Added

- Operations read-model table
- Idempotent PostgreSQL projector
- Processing log integration
- Failed-event retry function
- Full projection rebuild function
- Historical event backfill
- TypeScript projector package and tests

## Changed

- Operations Center live flights now read from `operations_flight_projection`

## Runtime impact

Every supported flight event is projected immediately after insertion. Projector errors are recorded without deleting the source event.

## Security impact

Projector mutation functions are restricted to trusted service-role execution. The read model is selectable by authenticated users.
