# @kva/operations-projector

Builds a query-optimized operational flight state from KVA domain events.

## Consumer name

`operations.projector`

## Supported events

- `flight.booked`
- `aircraft.assigned`
- `dispatch.created`
- `flight.boarding_started`
- `flight.pushback_started`
- `flight.takeoff_recorded`
- `flight.landing_recorded`
- `flight.completed`
- `pirep.created`

The TypeScript projector is the executable contract and test harness. Supabase runs the durable PostgreSQL projector included in this pack.
