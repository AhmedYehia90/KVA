# Event Operations Console

## Purpose

The Event Operations Console is the internal administration surface for the KVA event stream and the `operations.projector` consumer.

## Route

`/operations/events`

## Access model

Access requires all of the following:

1. An authenticated KVA user.
2. The user's login email must be included in `KVA_OPERATIONS_ADMIN_EMAILS`.
3. The server runtime must have `SUPABASE_SECRET_KEY` or the legacy `SUPABASE_SERVICE_ROLE_KEY`.
4. The elevated key is created only in a server-only module.

Unauthorized users receive a not-found response, and the Operations Center does not show the console link to them.

## Capabilities

- Inspect recent domain events and payloads.
- Filter by exact event type.
- Inspect `operations.projector` processing states.
- Retry one failed event.
- Retry failed and pending projector events in batches.
- Inspect the operations flight projection.
- Rebuild the disposable projection from the durable event stream.
- Audit every maintenance action.

## Safety rules

- The secret key must never use a `NEXT_PUBLIC_` prefix.
- The secret key must never be committed.
- Rebuild requires the exact confirmation phrase `REBUILD`.
- Source events are not edited or deleted.
- Maintenance actions are recorded in `operations_console_audit`.
