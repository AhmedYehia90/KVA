# KVA OS — Pillar 10 Living Airports v1.0 — COMPLETE

## Product role

Living Airports is the final world-awareness layer of KVA OS.

The project definition calls for airports that feel alive inside the platform
through operational context, activity, events and dynamic aviation-world
information connected to the wider KVA OS ecosystem.

Pillar 10 v1.0 completes that direction without pretending that KVA OS has
real-world ATC/NOTAM/weather authority.

---

## 1. Living Airports World

Route:

`/airports`

Every active KVA OS airport becomes a world node.

The world projection combines:

- airport identity
- ICAO / IATA
- city / country
- latitude / longitude
- timezone / live local clock
- active route links
- aircraft currently recorded on the ground
- live KVA OS movement links
- completed flight activity in the last 24 hours
- Global Aviation Event route links
- active KVA OS airport notices
- Route Support interest signals
- KVA OS Airport Pulse score

---

## 2. KVA OS Airport Pulse

Pulse is a product-defined **KVA OS platform activity score**.

It is derived from:

- live movements
- 24-hour completed activity
- ground fleet presence
- active network routes
- active Global Aviation Event links
- active KVA OS notices
- Route Support interest signals

Labels:

- QUIET
- ACTIVE
- BUSY
- HIGH ACTIVITY

Pulse is not a claim about real-world airport traffic.

---

## 3. Living Airport Detail

Route:

`/airports/[icao]`

Each airport page includes:

### Airport identity

- ICAO / IATA
- official stored airport name
- city / country
- coordinates
- timezone
- local clock

### Live Airport Board

Event-driven KVA OS flight projection:

- flight number
- direction
- lifecycle status
- connected airport
- aircraft registration
- aircraft type
- pilot callsign when recorded
- latest flight event timestamp

### Fleet on Ground

Derived from:

`aircraft.current_airport_id`

### Route Network

Derived from active KVA OS routes.

### Global Aviation Events

Uses existing:

- `global_aviation_events`
- `global_aviation_event_routes`
- `routes`

Only published, non-ended event routes appear.

### Route Interest

Uses existing Route Support Campaigns as community interest signals.

This does not activate a route.

### Pilot ↔ Airport Connection

The current pilot can see:

- completed visits
- departures
- arrivals
- first recorded visit
- latest recorded visit

### Recent Airport Activity

Recent completed KVA OS movements touching the airport.

---

## 4. Airport World Notices

New table:

`airport_world_notices`

These notices are **KVA OS platform/airline world context**.

Categories:

- Operations
- Event
- Community
- Network
- Advisory

Severity:

- Info
- Watch
- Important

Lifecycle:

`Draft -> Published -> Closed`

A published notice may have an effective time window.

Notices are explicitly NOT:

- real-world NOTAM
- ATC instruction
- real-world airport closure authority
- weather data
- verified real-world traffic status

unless a future verified external integration is intentionally added.

---

## 5. Airport World Console

Route:

`/operations/airports`

Authorized Operations users can:

- create notice Draft
- edit notice
- Publish
- Return to Draft
- Close
- add source label/reference
- define start/end window
- review audit history

Operations authority reuses the existing KVA OS protected console pattern:

- `requireOperationsConsoleAdmin()`
- service-role Admin client
- service-role-only write RPCs

---

## 6. Audit and Event Platform

Audit table:

`airport_world_admin_audit`

Domain events:

- `airport.notice_created`
- `airport.notice_updated`
- `airport.notice_published`
- `airport.notice_drafted`
- `airport.notice_closed`

Airport browsing itself creates no write.

---

## 7. Existing authoritative sources reused

Pillar 10 reads existing evidence from:

- `airports`
- `routes`
- `flight_bookings`
- `operations_flight_projection`
- `aircraft`
- `fleet_types`
- `profiles`
- `global_aviation_events`
- `global_aviation_event_routes`
- `route_support_campaigns`
- KVA OS Event Platform

The operational seed already establishes the connected airport network,
aircraft home/ground locations and scheduled route graph.

---

## 8. Integrity

Living Airports cannot:

- book/cancel/progress a flight
- change a PIREP
- change a route
- activate Route Support as a route
- change aircraft assignment
- move an aircraft
- create a fleet registration
- award Career XP
- modify pilot/company KVC
- write Economy Ledger
- award Global Aviation Event credit
- fabricate weather/NOTAM/ATC information

Key rule:

`World awareness != operational authority`

---

## 9. Navigation

Authenticated main navigation exposes:

`Airports`

Operations Center exposes:

`Open Airport World Console`

---

## 10. End-to-end product loop

KVA OS now closes its intended ten-pillar loop:

`Identity -> Flight -> Operations -> Replay -> Debrief -> Learning -> Dispatcher -> Events -> Career & Economy -> Legacy -> World`

Living Airports is the `World` layer.

---

## 11. Pillar status

**Pillar 10 — Living Airports v1.0: COMPLETE for acceptance review.**

After explicit user approval:

**KVA OS = 10 / 10 core pillars completed.**
