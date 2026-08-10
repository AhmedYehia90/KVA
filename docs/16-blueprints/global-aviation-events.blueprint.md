# Global Aviation Events Blueprint

Status: Implemented in Pack v1.0

## Objective

Make KVA OS feel larger than one airline by creating shared aviation campaigns
that multiple organizations and pilots can participate in.

## Lifecycle

1. Operations publishes an event.
2. Eligible routes are attached as missions.
3. Pilots see the event in the global hub.
4. A pilot joins through an active airline membership.
5. The pilot books and flies an eligible mission.
6. A submitted/approved PIREP is credited automatically.
7. Progress and points update.
8. Meeting the event target completes participation.
9. A completion achievement is awarded.
10. The event remains visible in history.

## Core tables

- `global_aviation_events`
- `global_aviation_event_organizations`
- `global_aviation_event_routes`
- `global_aviation_event_participations`
- `global_aviation_event_flights`
- `global_aviation_event_achievements`

## Cross-airline design

Event participation stores the organization through which the pilot joined.
Events can allow every KVA OS organization or be restricted to explicitly
attached organizations.

Kalabsha Airlines is the founder host for the bootstrap event, not a hard
platform limitation.

## Safety / integrity

- Event credit never rewrites the PIREP.
- Event credit never changes a booking.
- Event credit never changes aircraft state.
- Duplicate PIREP credit is prevented per participation.
- A background event-credit failure cannot block PIREP submission.
- Pilot rows are private through RLS.
- Aggregate network counts are exposed through bounded RPCs.

## Bootstrap event

The migration publishes `KVA OS Global Launch Relay` with up to four active
routes so the pillar can be tested immediately.
