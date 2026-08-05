# Event Operations Console Blueprint

Status: Implemented in Pack v1.0

## Objective

Give authorized KVA operators a controlled interface for observing and maintaining the event-processing layer.

## Users

- KVA platform owner
- Authorized operations administrator
- Future reliability engineer

## User journeys

### Inspect

1. Open the Operations Center.
2. Open Event Console.
3. Filter events or processing records.
4. Inspect payload, correlation, errors and projection state.

### Retry

1. Find a failed projector record.
2. Retry one event or a bounded batch.
3. Review the result.
4. Confirm an audit entry was created.

### Rebuild

1. Confirm the event stream is healthy.
2. Type `REBUILD`.
3. Reconstruct the disposable projection.
4. Review event count and audit trail.

## Business rules

1. Only configured administrator emails may enter.
2. Elevated Supabase credentials remain server-only.
3. Every privileged action is audited.
4. Retry is idempotent.
5. Rebuild never deletes source events.
6. Rebuild confirmation is explicit.
7. Event payloads are shown only inside the protected console.
8. Normal pilots cannot see the console link.

## Database impact

Adds `operations_console_audit`.

## Environment impact

Adds:

- `SUPABASE_SECRET_KEY` preferred
- `SUPABASE_SERVICE_ROLE_KEY` supported as legacy fallback
- `KVA_OPERATIONS_ADMIN_EMAILS`

## Test plan

- Web production build
- Authenticated non-admin receives not found
- Admin can inspect data
- Retry one failed event
- Retry batch
- Rebuild with invalid confirmation is rejected
- Rebuild with valid confirmation succeeds
- Every action appears in audit
- Secret key is absent from client bundles and Git
