# Scheduled-booking cutover candidate — 18 November 2026

Status: the owner applied the prepared/OFF cutover through the existing hosted SQL Editor. The follow-up verification CSV confirms prepared, scheduling_enabled=false, api_mode=false, unchanged archived sources, preserved public EXECUTE grants, blocked private archive calls and an enabled booking guard. No activation occurred. SQL was executed by the owner, not through this workspace API key. The UI dual-gate source is being published as a separate reviewed release after that verification.

## Two independent gates and a separate preparation step

The production candidate is NOT the disruptive staging installer. `supabase/production/20261118_scheduling_cutover_prepare.sql` requires a fresh scoped backup checksum and verified inactive foundation. It installs the new RPCs, permission policies and a shared booking-write guard but keeps database mode OFF (`prepared`). Existing book_route and progress routines remain operational through wrappers; their original OIDs/bodies/configuration are retained privately with EXECUTE removed from clients. Public wrappers retain the original ordered EXECUTE ACLs. All existing booking records are preserved.

`scheduledBookingEnabled` in the web app now requires BOTH the application environment flag and the actual database `scheduling_mode_enabled()` result. Missing/failed/false RPC results do not enable the new UI. When DB mode is OFF, even an early application flag does not redirect existing flight selection, old booking actions, or detail queries into scheduled mode. Production SQL rejects scheduled writes while OFF independently of the UI. The dual-gate UI is included in the next code publication; keep the production flag unchanged until its exact revision and legacy behavior are verified. Never activate using the older single-gate release.

When ON, the database rejects new legacy active bookings, direct client mutations and even archived definer routines that attempt a new old-style booking. This protects the shared aircraft ledger against bypasses, not only the public book_route wrapper. Pilot identity/status, own cancellation, unique occurrence/pilot indexes, aircraft exclusion constraints, complete rotation checks and actual readiness remain enforced.

## Concurrency and activation

All booking/management paths use a shared transaction advisory mode lock. Owner activation uses the corresponding exclusive lock, so a legacy booking already in progress finishes before the activation decision. If it commits an active booking, activation fails instead of switching over around it. Existing legacy flight progress/completion remains available while prepared/OFF. No existing booking is forcibly cancelled or assigned a fabricated date.

Owner-only `kva_scheduling_private.activate_scheduled_booking()` requires prepared/OFF mode, zero active legacy bookings, reviewed fleet rules, at least one published dated flight, future preparation windows, active routes and complete allocations. It locks/revalidates the aircraft rotation, maintenance and location state before changing mode. No ordinary pilot, service-role REST call or administrator UI can directly execute this private function.

This activates scheduled BOOKING ONLY. Scheduled departure/progress/autopilot/IVAO accounting remain disabled in phase one. Production activation must not be mistaken for a complete flight-execution rollout.

## Backup, rollback and actual data

`supabase/review/20261118_scheduling_cutover_backup.sql` exports the current foundation, empty/new table contents, full existing booking records and relevant schema/routine/ACL baseline in one deterministic JSON payload plus checksum. Save the CSV privately off-server and share only backup_checksum. It is a scoped migration backup, not a complete database/Auth/password/storage backup. The earlier foundation checksum is not reusable for this new migration.

Preparation refuses a missing/stale checksum, changed legacy definitions/ACLs since foundation, existing preparation or unsupported function ownership/custom grantors. Unsupported metadata requires explicit review, never silent permission rewriting. The private cutover snapshot is restricted, but it does not replace the off-server export.

`20261118_scheduling_cutover_rollback.sql` works ONLY while prepared/OFF and before any new scheduling rules/flights/allocations/bookings are written. It preserves all current legacy booking records, including bookings made after preparation, restores exact original routine OIDs/definitions/grants, and returns to foundation/OFF. It uses RESTRICT, never CASCADE. After configuration or use, it deliberately refuses data loss; use a separately reviewed forward/recovery plan. Do not force it by deleting scheduling data.

Use `20261118_scheduling_cutover_verify.sql` after preparation or activation. The foundation-only routine comparator is no longer the appropriate verifier because public functions are intentionally wrappers; the new verifier checks the unchanged archived bodies, original public EXECUTE ACLs, denied archive access and enabled booking guard.

No real timetable, turnaround rule, fake pilot or new aircraft was seeded. Test times, routes, users and registrations are synthetic only.

## Passing isolated real-Supabase checks

Real GoTrue/Kong/PostgREST/PostgreSQL with all 49 repository migrations and a fresh foundation, not an Auth/API adapter:

- Missing backup and injected failure preserve original routine identities and data atomically.
- Prepared mode stays OFF; real old booking creates its dispatch; scheduled booking is refused.
- Empty prepared rollback restores exact old OIDs/definitions/ACLs and preserves a booking created after installation.
- All five real legacy progress transitions complete while OFF; prepared plans are hidden from ordinary pilots.
- Activation refuses active legacy bookings, maintenance and changed aircraft location.
- A real HTTP legacy booking is held in-flight: activation waits for its shared lock, sees its committed active record and refuses the transition.
- After reviewed test activation, public/private/direct legacy write bypasses are rejected without partial records.
- Simultaneous real scheduled booking produces one winner; own cancellation/rebooking preserve history.
- Simultaneous shared-aircraft allocation cannot double-allocate the tail. Actual aircraft position and scheduled test-pilot hours stay unchanged.
- Rollback refuses after activation. The read-only verifier confirms retained old sources/grants and blocked private archive calls.

Fresh sanitized `pnpm verify`: **90 tests**, types, lint and production build passed. Existing fleet CSS autoprefixer warning remains unrelated. Dependency advisory tracking from the published release is unchanged; no new clean-audit claim is made.

Browser checks against real services, using BOTH actual prepared/OFF and activated test modes, Arabic/English at 390/1440 px:

- Application flag ON + database OFF keeps the legacy flight list and returns 404 for the scheduled page.
- Actual enabled mode supports password login, schedule listing, booking, full existing booking detail joins, cancellation and retained history.
- Correct direction, no horizontal overflow or page JavaScript errors in the active path; execution button remains absent for scheduled bookings.

Logs: `/tmp/kva-cutover-results.log`, `/tmp/kva-cutover-browser-off.log`, `/tmp/kva-cutover-browser.log`, `/tmp/kva-cutover-verify.log`.

## Ordered production proposal — not yet executed

1. Export/save the fresh cutover backup and bind its checksum to the preparation SQL. Apply the entire preparation transaction in the existing owner SQL Editor, then run the read-only cutover verifier. Expected prepared/OFF, zero newly seeded rows, true archive/grant/guard checks.
2. Review and publish the new two-gate application code with the application flag still OFF. Only this updated code is safe for a premature application flag. No database-mode flip is caused by a web deployment.
3. Agree the real fleet preparation/turnaround rules, dated timetable and timezone, and aircraft rotations. Configure them using the authorized staff RPCs. Do not invent them from the sample 20:00 flight.
4. In a controlled reviewed rollout, set the application flag using the updated code while DB remains OFF; verify the old route still works. Then owner may run the separate activation SQL after the execution-scope limitation is accepted. Revalidate live booking/cancellation and access boundaries without submitting real operational records unnecessarily.
5. Automatic/simulated flight execution is a later phase. Do not start it or mix its hours with real pilot/IVAO totals.

This workspace still has API access rather than hosted SQL/DDL credentials. The owner supplied the actual successful hosted preparation and verification results. Activation is still pending and requires reviewed real fleet timings/timetable plus the gated application release; no activation SQL was executed by this workspace.
