# Black Box Replay Blueprint

Status: Implemented in Pack v1.0

## Objective

Allow an airline operations team to reconstruct exactly what KVA OS recorded
for a flight, in chronological order, from booking through PIREP.

## Inputs

- `platform_events`
- `event_processing_log`
- `operations_flight_projection`
- Existing booking, aircraft, dispatch and PIREP identifiers

## Outputs

- Replay archive index
- Ordered event evidence
- Integrity report
- Investigation notes
- JSON export
- Privileged access audit

## Security

- Existing operations administrator allowlist
- Server-only Supabase secret client
- No direct authenticated or anonymous table policies
- Export and note actions are audited

## Non-goals for v1.0

- No fictional simulator telemetry
- No automatic incident judgment
- No mutation of source events
- No replacement for the future Digital Flight Companion or Mentor AI
