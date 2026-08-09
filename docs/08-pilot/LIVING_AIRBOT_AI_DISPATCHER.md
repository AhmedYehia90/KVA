# Living Airbot — AI Dispatcher

Living Airbot is the pilot-facing live dispatcher layer of KVA OS.

## Purpose

Each booking receives a private dispatch session that follows the flight
lifecycle from preflight through completion.

## v1.0 evidence

- Booked route
- Departure and arrival ICAO codes
- Published route block time
- Dispatch record
- Aircraft assignment
- Aircraft type
- Aircraft fleet status
- Flight booking phase
- Durable KVA OS flight events

## Readiness

The dispatcher shows four explainable checks:

1. Published route
2. Dispatch record
3. Aircraft assignment
4. Aircraft operational state

The result is shown as:

- Ready
- Attention
- Blocked

## Living behaviour

The session automatically updates when KVA OS records:

- `flight.booked`
- `aircraft.assigned`
- `dispatch.created`
- `flight.boarding_started`
- `flight.pushback_started`
- `flight.takeoff_recorded`
- `flight.landing_recorded`
- `flight.completed`

## Pilot conversation

Pilots can ask:

- Brief me
- Readiness
- Aircraft
- Next step
- A custom question

The response is bounded to recorded KVA OS dispatch evidence.

## Trust boundary

v1.0 does not invent:

- Weather
- ATC instructions
- Navigation procedures
- VOR instructions
- Aircraft assignments
- Simulator telemetry
- Unrecorded operational facts

## Route

`/pilot/airbot`
