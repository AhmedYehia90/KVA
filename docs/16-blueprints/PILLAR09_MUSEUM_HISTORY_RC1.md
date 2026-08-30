# KVA OS — Pillar 09 Museum / History — RC1

## Scope

RC1 establishes the first **read-only pilot legacy projection**.

It intentionally does not create a second source of truth for historical facts.

## Existing authoritative sources reused

- Universal Pilot Passport
- Pilot Career Account
- Career Milestones
- Career Promotion History
- Pilot Type Ratings
- Global Aviation Event Achievements
- Completed Flight Bookings
- Routes / Airports / Aircraft / Fleet Types

## Added

### RPC

`public.get_pilot_museum_history()`

Returns:

- `summary`
- `memories`
- `timeline`

The function is authenticated, security-definer and read-only.

### Pilot page

`/pilot/history`

Shows:

- legacy start date
- career summary
- first completed operation
- most-flown aircraft type
- latest promotion
- first Global Aviation Event achievement
- chronological legacy timeline

## Non-negotiable rules

- no Economy Ledger mutation
- no wallet/company balance mutation
- no fleet mutation
- no route activation
- no PIREP mutation
- no career XP/rank mutation
- no new history facts table
- no client access to internal `platform_events`
- original domain systems remain authoritative

## RC2 direction

After RC1 is validated:

- Company / Airline Museum
- curated company-history entries for narrative facts that cannot be derived from operations
- pilot ↔ airline legacy connections
- anniversary / “On This Day” presentation
- optional deep links to evidence views such as Black Box Replay

Curated company history, if added, must be visibly distinct from derived operational history.
