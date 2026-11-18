# Scheduling phase 1 — isolated implementation and review

## Scope and deployment boundary

Implemented for the user's approved **isolated first phase only**. No hosted Supabase SQL, GitHub push, Vercel deployment, production configuration change, IVAO request, automatic flight execution, production pilot account, or production data copy was performed. Existing uncommitted passport security artifacts were preserved.

The SQL is deliberately in `supabase/staging/scheduling_phase1.sql`, outside the automatic migration directory. It refuses to run without `kva.scheduling_test_environment=isolated`. This is an accidental-use guard, not a security boundary against a PostgreSQL owner. The implementation is a one-time installation on a disposable test database; it is not a production migration or an idempotent deployment script.

Web entry points use server-only `KVA_SCHEDULING_PHASE1_ENABLED=true`. It is absent/off by default. With the flag off `/pilot/schedule` is 404 and existing flight selection/booking code follows its original behavior. Do not enable it against production.

## Database changes tested

- `fleet_scheduling_rules`: preparation and turnaround minutes configured by fleet type. No guessed operational defaults or real seed schedule.
- `scheduled_flights`: dated UTC occurrences with copied flight number, fleet type and airport endpoints, validated display timezone, duration, rule snapshots and published/cancelled status. Editing a route template does not rewrite an occurrence.
- `aircraft_allocations`: shared occupancy ledger for flight assignments and maintenance windows. GiST exclusion with `btree_gist` prevents overlapping active intervals for one tail. One active flight allocation per occurrence. Preparation and turnaround are part of the half-open occupancy interval.
- Nullable `flight_bookings.scheduled_flight_id` and a partial unique index for one active booking per occurrence. Existing active-pilot uniqueness is retained. Legacy records are not backfilled, deleted, or assigned invented dates.
- No simulation fleet or simulation hours in this phase. Aircraft identity, current positions, pilot totals, legacy bookings and public passport permissions are not rewritten.

## Booking and resource safety

Staff RPCs configure rules, create/allocate, reschedule/reassign, cancel schedules, and create/release maintenance blocks. Active staff authorization is checked inside the database; pilots/anon have no direct schedule/allocation mutation grants. New SECURITY DEFINER functions have a fixed empty search path, qualified application objects and explicitly revoked PUBLIC execution.

Allocation locks the tail; booking locks the active pilot profile, dated occurrence and tail. Database exclusion/unique constraints remain the final concurrency boundary. Tests use independent PostgreSQL connections.

The entire aircraft rotation must connect airport-to-airport from the current known location. Both predecessor and successor are rechecked when changing/releasing assignments. Unknown location, incompatible fleet, current maintenance/nonactive status, operationally busy aircraft and unresolved legacy active bookings block allocation. Future maintenance uses the SAME exclusion constraint as flights. Cancelling a middle leg that would strand the next leg is rejected atomically; management must first revise the dependent rotation.

Scheduled booking creates a booking, dispatch (using the existing dispatch numbering trigger), and `schedule.booking_created` domain event atomically. This namespace avoids old event projectors marking a future reserved flight as a current aircraft movement. A pilot may cancel only their own unstarted scheduled booking; cancellation retains the record and does not remove the published flight's aircraft allocation. Another pilot may then book that occurrence.

All new client booking writes must use the reviewed scheduled RPC. In the isolated database old `book_route` is disabled; direct authenticated booking INSERT/UPDATE/DELETE cannot bypass the RPC. Existing progress RPCs are wrapped: scheduled flight execution is disabled in phase 1, and legacy functions are preserved for old records with direct wrapper-bypass EXECUTE grants revoked. This phase does not assert that scheduled takeoff/arrival processing is implemented.

## UI

`/pilot/schedule` lists the date/time and timezone of departure/arrival, airport codes and registration, availability, own booking link and cancellation. Arabic/RTL and English/LTR use the existing visual components/classes. Display times use Intl with the occurrence timezone and daylight-saving rules. Failures show a generic localized error rather than provider SQL. The feature-enabled legacy flight list redirects to the dated list, and its old booking action cannot call the old RPC.

Staff scheduling is exposed as tested RPCs, not a new administration editor in this phase. Operations remain disabled for scheduled bookings until a separately reviewed next phase.

## Isolated test environment and evidence

- Real PostgreSQL 17 Alpine in Docker container `kva-scheduling-phase1`, label `kva.scope=isolated-scheduling-test`, network mode **none**, no published ports, ephemeral tmpfs database storage. All profiles, airports, registrations and bookings are synthetic. Test runners verify isolation labels/network before resetting the dedicated test database.
- `tests/scheduling/test_phase1.py`: actual stage SQL, repository event writer and existing booking/progress routines compiled against a reduced synthetic schema. Covers staging guard, row preservation, RLS/grants, overlap SQLSTATE 23P01, maintenance, location/type/time errors, predecessor/successor continuity, cancellation, concurrent same-occurrence bookings, concurrent tail allocations, one pilot racing different occurrences, rescheduling/reassignment, midnight and immutable airport snapshots.
- `apps/web/tests/scheduling.test.mjs`: default-off guard, identifier/auth checks, scheduled RPC selection, cancellation/failure privacy, Cairo winter/summer date rollover and Arabic formatting. Added to the regular web test script.
- `tests/scheduling/run_web_checks.py`: local test-only Auth/PostgREST adapter forwarding scheduling calls to the isolated PostgreSQL database. It strips injected Supabase/KVA/database/Vercel/SMTP/IVAO configuration and supplies only a local URL and synthetic key/session. This is not a deployed Supabase Auth verification or a production API server.
- Fresh `pnpm verify` using that sanitized environment passed **88 tests**, types, lint and production build. An existing fleet CSS autoprefixer warning remains unrelated.
- Chromium checks Arabic/English at 390 and 1440 pixels: correct direction, no horizontal overflow or page JavaScript errors; real staged booking/cancellation, legacy-list redirect, and flag-off 404 verified.
- Logs: `/tmp/kva-phase1-db-tests.log`, `/tmp/kva-phase1-browser-tests.log`, `/tmp/kva-phase1-web.log`.

## Reproduce and review

Start the disposable PostgreSQL container (if not already running):

```sh
docker run -d --name kva-scheduling-phase1 --network none \
  --label kva.scope=isolated-scheduling-test \
  --tmpfs /var/lib/postgresql/data:rw \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=kva_phase1 postgres:17-alpine
python tests/scheduling/test_phase1.py
python tests/scheduling/run_web_checks.py
```

The test runner resets ONLY `kva_phase1_test` inside the verified disposable container. No external DSN is accepted. Local trust authentication is confined to a network-disabled synthetic container. The web adapter is loopback-only and must never be deployed. Browser runner closes its test web processes and adapter. The database remains available for local inspection; its data is disposable.

The built `.next` output uses synthetic LOCAL public Supabase configuration. It is not a production deployment artifact and must not be uploaded. An approved future production deployment requires a fresh build with reviewed production configuration.

## Required before any production proposal

Review these results with the owner first. A subsequent real local Supabase core integration using all 49 repository migrations, Auth, Kong and PostgREST has now passed; see SUPABASE_SCHEDULING_INTEGRATION.md. Before production, still verify actual hosted schema differences, operational booking inventory and the reviewed cutover plan. Production transition needs its own reviewed migration, backup and recovery plan, legacy-booking reconciliation, confirmed fleet turnaround rules/locations and staged rollout. Do not apply this staging SQL to production.

The next phase must add actual/simulated operation states, delay/arrival/diversion handling and a safe authoritative location/event-order policy before any automatic departure. No simulation or IVAO hours can be produced by the current stage.

## Real Supabase follow-up

See [real Supabase integration results](SUPABASE_SCHEDULING_INTEGRATION.md). Actual Auth/REST/API-concurrency and browser booking/cancellation now pass against the complete repository schema. The booking detail hides the execution button for scheduled records only when the phase-one flag is enabled. No production change or commit was made.
