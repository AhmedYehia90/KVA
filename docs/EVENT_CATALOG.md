# Event Catalog

## Naming
`domain.entity.action` in lowercase.

## Envelope
id, event_type, event_version, organization_id, aggregate_type, aggregate_id, actor_id, correlation_id, causation_id, occurred_at, payload, metadata.

## Core events
flight.booked
aircraft.assigned
dispatch.created
flight.boarding_started
flight.pushback_started
flight.taxi_started
flight.takeoff_recorded
flight.cruise_started
flight.descent_started
flight.landing_recorded
flight.arrived
flight.completed
pirep.created
pilot.promoted
salary.paid
legacy.moment_created
story.entry_created
airport.status_changed
global_event.started
mentor.debrief_created
aviation_dna.updated
