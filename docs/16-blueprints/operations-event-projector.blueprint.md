# Operations Event Projector Blueprint

Status: Implemented in Pack v1.0

## Objective

Build a fast and rebuildable OCC read model from KVA flight events.

## Inputs

- `flight.booked`
- `aircraft.assigned`
- `dispatch.created`
- `flight.boarding_started`
- `flight.pushback_started`
- `flight.takeoff_recorded`
- `flight.landing_recorded`
- `flight.completed`
- `pirep.created`

## Output

One `operations_flight_projection` record per booking with the current operational state and last projected event.

## Business rules

1. Duplicate delivery must not increment the projection twice.
2. Flight lifecycle events update one booking projection.
3. Processing failure must not delete or mutate the source event.
4. Failed processing is logged for retry.
5. The read model is disposable and rebuildable.
6. The event stream and domain tables remain the source of truth.
7. Projector execution is not available to normal client sessions.

## Database impact

- Adds `operations_flight_projection`
- Uses `event_processing_log`
- Adds projector, retry, rebuild, and trigger functions
- Backfills existing flight events

## UI impact

The Operations Center live-flight section reads from the new projection. Fleet and recent PIREP summaries remain on their existing sources.

## Test plan

- Package typecheck
- Four projector unit tests
- Event Core tests
- Web production build
- Supabase dry run and push
- Manual booking lifecycle test
- Verify processing records use consumer `operations.projector`
