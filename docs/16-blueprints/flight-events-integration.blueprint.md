# Flight Events Integration Blueprint

Status: Implemented in Pack v1.0

## Objective

Make every important flight workflow transition observable, durable, correlated, and reusable by future KVA engines.

## Existing workflow preserved

- Route booking through `book_route`
- Automatic aircraft selection
- Automatic dispatch generation
- Pilot-controlled flight progression
- PIREP submission after completion

## New behavior

Each successful workflow mutation writes a versioned domain event in the same database transaction.

## Business rules

1. A pilot may have only one active booking.
2. Booking and dispatch events must not exist without their business records.
3. Flight transitions are sequential and server-authoritative.
4. A PIREP may be created once and only after completion.
5. Event records are append-only.
6. Client sessions cannot write directly to the event store.
7. Consumers use `(event_id, consumer_name)` for idempotency.

## Database impact

- `platform_events`
- `event_processing_log`
- `append_domain_event`
- Updated `book_route`
- New `advance_flight_booking`
- Updated `submit_booking_pirep`

## UI impact

No visual redesign. The existing booking and flight-progress UI calls transactional RPCs.

## Test plan

- Event Core typecheck
- Existing Event Core tests
- Flight contract tests
- Web production build
- Supabase migration dry run
- Manual booking lifecycle smoke test

## Rollback

Restore the previous web action and RPC definitions. Event tables may remain because they are additive and preserve audit history.
