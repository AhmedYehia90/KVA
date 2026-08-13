# KVA OS — Pillar 09 Museum & History v1.0 — COMPLETE

## Pillar purpose

Museum & History is the long-term memory and legacy layer of KVA OS.

It turns years of evidence-backed aviation activity into a persistent story
without creating a second source of operational truth.

The original Pillar 09 direction was:

- milestones
- first flights
- aircraft memories
- anniversaries
- historic achievements
- pilot timeline
- airline history

Pillar 09 v1.0 now covers that full direction.

---

## 1. Pilot Museum

Route:

`/pilot/history`

Capabilities:

- Universal Pilot Passport legacy start
- Career XP
- completed flights
- flight hours
- human-readable current rank
- milestones
- aircraft types flown
- first completed operation
- most-flown aircraft type
- latest promotion
- first Global Aviation Event achievement
- chronological timeline
- flights
- milestones
- promotions
- qualifications
- event achievements
- passport identity evidence

The Pilot Museum is a read-only projection.

---

## 2. Airline Museum

Route:

`/pilot/history/company`

The airline timeline combines two explicitly different history classes.

### DERIVED

Facts derived from authoritative systems such as:

- Company Economy assets
- Economy Ledger
- Operations-reviewed Route Support interest

### CURATED

Narrative history written and published by authorized Operations users.

The UI visibly labels both so narrative history can never masquerade as
operational evidence.

---

## 3. Museum Curator

Route:

`/operations/history`

Operations workflow:

`Create Draft -> Review/Edit -> Publish -> Airline Museum`

Curated fields:

- title
- category
- summary
- long details
- occurred date
- era label
- source label
- source reference
- Draft / Published state

Categories:

- Company History
- Fleet History
- Network History
- Community History
- Event History
- Technology History
- Other

Every curator write creates:

- Museum administration audit record
- KVA OS Event Platform domain event

Published curated stories are read by Airline Museum.

Undated curated entries remain valid history, but they do not participate in
anniversary calculations until an explicit real date is supplied.

---

## 4. Living Memories

Route:

`/pilot/history/memories`

Living Memories adds the temporal layer that makes the Museum feel alive.

### On This Day

When a real recorded date returns in a later year, KVA OS can resurface:

- journey / Universal Pilot Passport anniversary
- completed flight anniversary
- milestone anniversary
- promotion anniversary
- aircraft qualification anniversary
- Global Aviation Event achievement anniversary
- dated published airline-history anniversary

### Anniversary Calendar

The nearest upcoming annual occurrences are calculated from real source dates.

No duplicated anniversary table is maintained.

### New journeys

A new pilot can see:

- days since their KVA OS journey began
- the next journey anniversary
- memory sources already available
- future anniversary dates

Even when no one-year anniversary exists yet, the engine is already active.

---

## 5. Pilot ↔ Airline Legacy Connection

Airline Museum shows organization-scoped pilot connection evidence such as:

- Career & Economy evidence-backed flights
- Route Support contribution count
- historical KVC contribution amount

This does not grant company or route authority.

---

## 6. Evidence model

### Operational / derived evidence

Existing systems remain authoritative:

- `pilot_passports`
- `flight_bookings`
- `routes`
- `airports`
- `aircraft`
- `fleet_types`
- `pilot_career_accounts`
- `pilot_career_milestones`
- `career_milestone_definitions`
- `career_promotion_history`
- `pilot_type_ratings`
- `global_aviation_event_achievements`
- `global_aviation_events`
- `career_economy_pirep_awards`
- `company_economy_assets`
- `economy_ledger`
- `route_support_campaigns`
- `route_support_contributions`

### Curated evidence

`museum_company_history_entries`

Curated history is intentionally separate and visibly labelled.

### Curator audit

`museum_history_admin_audit`

---

## 7. Authority and safety

Pillar 09 MUST remain a legacy layer.

It cannot:

- award Career XP
- change rank
- change pilot wallet
- change company KVC balance
- write Economy Ledger transactions
- buy aircraft
- register aircraft
- change fleet state
- activate routes
- convert Route Support into automatic route authority
- change a PIREP
- invent dates for company history

Key rules:

`History != operational authority`

`Curated narrative != derived evidence`

`Economic aircraft asset != operational fleet registration`

`Route Support approval != automatic route activation`

---

## 8. Navigation

Authenticated navigation exposes:

`History`

Operations Center exposes:

`Open Museum Curator`

Museum sub-navigation connects:

- Pilot Museum
- Airline Museum
- Living Memories

---

## 9. Completion flow

Pilot legacy:

`Flight -> Evidence -> Career/Events -> Museum Timeline -> Living Memory`

Company legacy:

`Company Evidence -> Derived Airline History`

Curated company legacy:

`Operations Curator -> Draft -> Publish -> Airline Museum -> Anniversary Memory`

---

## 10. Pillar status

**Pillar 09 — Museum & History: COMPLETE for v1.0 acceptance review.**

After user review and explicit approval, the project can advance to:

**Pillar 10 — Living Airports**
