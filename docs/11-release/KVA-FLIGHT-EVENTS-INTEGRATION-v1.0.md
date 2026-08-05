# KVA Flight Events Integration v1.0

## Added

- Durable Supabase event stream
- Internal append-only event function
- Atomic booking and dispatch events
- Transactional flight status RPC
- Atomic PIREP event
- Flight event contract registry
- Contract validation tests

## Changed

- Flight progression now calls `advance_flight_booking`
- Event Core package version updated to 1.1.0

## Runtime impact

The user-facing workflow remains unchanged. Business mutations now append internal events.

## Security impact

Event tables use RLS and expose no client-facing policies. Direct append execution is revoked from public, anonymous, and authenticated roles.
