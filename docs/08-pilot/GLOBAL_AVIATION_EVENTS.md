# Global Aviation Events

Global Aviation Events is the shared network-event layer of KVA OS.

## Purpose

A pilot can join a global campaign, fly eligible event missions and build a
durable participation record that survives after the event ends.

## v1.0 capabilities

- Live, upcoming and historical event hub
- Event registration
- Event routes / missions
- Cross-airline organization model
- Live aggregate participation counts
- Evidence-backed flight credit from PIREPs
- Personal event progress
- Event points
- Completion achievements
- Event history
- Event Platform records
- Operations event publishing console

## Evidence rule

A flight is credited only when:

1. The pilot joined the event before the flight record.
2. The flight is inside the event window.
3. The booked route is an eligible event mission.
4. The PIREP is submitted or approved.
5. The same PIREP has not already been credited to the same participation.

Historical flights are not silently credited when a pilot joins later.

## Domain events

- `global_event.published`
- `global_event.joined`
- `global_event.withdrawn`
- `global_event.flight_credited`
- `global_event.completed`
- `global_event.achievement_awarded`
- `global_event.archived`
- `global_event.cancelled`

## Routes

Pilot hub:

`/pilot/events`

Operations control:

`/operations/global-events`
