# KVA Event Operations Console v1.0

## Added

- Protected `/operations/events` console
- Event stream inspection
- Processing status inspection
- Single-event retry
- Bounded batch retry
- Projection rebuild
- Maintenance action audit
- Environment-based administrator allowlist
- Server-only Supabase elevated client

## Changed

- Authorized Operations Center users see an Event Console link.

## Database impact

Adds `operations_console_audit`.

## Security impact

The console requires application-level authorization before creating the elevated Supabase client. Elevated keys are read only from server environment variables and are never exposed through public variables.
