# Universal Pilot Passport Blueprint

Status: Implemented in Pack v1.0

## Objective

Give every KVA OS pilot one portable identity and flight CV that can continue
across multiple virtual airlines.

## Scope

- Platform organizations
- Pilot passport
- Airline memberships
- Portable qualifications
- Experience ledger sourced from PIREPs
- Public sharing with privacy controls
- Automatic passport issuance for new profiles
- Historical profile and PIREP backfill

## Business rules

1. A pilot has one platform passport.
2. A pilot may have many airline memberships.
3. Only one active membership may be primary.
4. PIREPs remain the flight-record source of truth.
5. Public passport data never exposes email or authentication data.
6. Passport visibility defaults to private.
7. A pilot's experience survives movement between airlines.
