# Flight Event Integration v1.0

## Purpose

Connect the existing Supabase flight workflow to the KVA Event Core without creating a second booking system.

## Atomic boundary

The booking, dispatch, status transition, and PIREP RPCs append events inside the same PostgreSQL transaction as the business mutation. A failed event insert rolls back the related business change.

## Events

| Event | Trigger | Aggregate |
|---|---|---|
| `flight.booked` | Successful route booking | Flight booking |
| `aircraft.assigned` | Booking receives an aircraft | Aircraft |
| `dispatch.created` | Automatic dispatch creation | Dispatch |
| `flight.boarding_started` | Booked → Boarding | Flight booking |
| `flight.pushback_started` | Boarding → Departed | Flight booking |
| `flight.takeoff_recorded` | Departed → Enroute | Flight booking |
| `flight.landing_recorded` | Enroute → Landed | Flight booking |
| `flight.completed` | Landed → Completed | Flight booking |
| `pirep.created` | Successful PIREP submission | PIREP |

## Correlation

Events created by one booking command share a correlation ID. Causation links `aircraft.assigned` and `dispatch.created` to the preceding event in the booking chain.

## Access model

`platform_events` and `event_processing_log` have RLS enabled with no client-facing policies. Trusted server and service-role processes consume the event stream.

## Integration boundary

The web application continues to call Supabase RPCs. The RPC functions own validation, locking, mutation, and durable event append.
