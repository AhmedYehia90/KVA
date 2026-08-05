# Event Core Blueprint

## Objective
Create the reliable communication foundation used by every KVA domain without coupling modules to each other's private implementation.

## v1.0 scope
- Event envelope
- Event creation and validation
- Contract registry
- In-memory bus
- Append-only store interface
- In-memory store
- Processing log interface
- Idempotent handler
- PostgreSQL/Prisma schema
- Unit tests

## Out of scope
- Distributed queue
- Dead-letter dashboard
- Event replay UI
- Schema registry service
- Cross-region replication

## Acceptance criteria
- Duplicate event IDs are rejected.
- Correlation and causation are preserved.
- Consumers can safely receive the same event more than once.
- Event contracts can reject invalid payloads.
- Package builds and tests independently inside the pnpm workspace.
- Database migration is explicit and reviewable.
