# Scheduling production foundation — manual, additive, OFF

This directory contains reviewed production-candidate SQL. It is intentionally outside automatic migrations. Do not use `supabase/staging/scheduling_phase1.sql` in production. Do not enable `KVA_SCHEDULING_PHASE1_ENABLED` for this foundation.

## What changes

Creates three EMPTY scheduling tables, their validation/exclusion indexes and RLS; adds nullable `flight_bookings.scheduled_flight_id` and its partial uniqueness index; creates an owner-only `kva_scheduling_private.foundation_manifest`; installs `btree_gist` only if needed. It does not create scheduling RPCs, grant client access, seed fleet rules/flights, rewrite old rows, change any existing booking function/policy/trigger/grant, or enable scheduling/autopilot/IVAO integration.

Existing `book_route`, progress RPCs and existing booking access remain intact. The manifest fixes `phase=foundation` and `scheduling_enabled=false` with CHECK constraints. The new tables have RLS and no anon/authenticated/service_role grants; the private manifest schema is inaccessible to those roles. The nullable added column does not change existing table-level grants; without rows in the inaccessible new tables its FK prevents valid non-null assignment by a client. A later cutover must supply its own reviewed permissions and write guards.

## Step 1: scoped off-server backup, READ ONLY

Run `supabase/review/20261118_scheduling_foundation_backup.sql` as the owner in the EXISTING Supabase SQL Editor. Export the complete single-row result as CSV and keep the downloaded file private/off-server. It contains full booking records (including pilot UUIDs), legacy routine definitions/ACLs, columns, policies, indexes, constraints and triggers. This is a scoped backup of the affected foundation baseline, **not a full database/Auth/password/storage backup**. No existing records or routines will be overwritten by this migration or its rollback.

Send only `backup_checksum` for coordination, not the personal-data CSV. This MD5 is a deterministic baseline-drift check, not a digital signature, authentication mechanism or proof that an export was downloaded. The operator must actually retain the exported file. The internal manifest is an additional restricted baseline record, not a substitute for off-server backup.

## Step 2: apply foundation transaction

Only after the export is saved, open `20261118_scheduling_foundation.sql` and replace the literal `PASTE_BACKUP_CHECKSUM_HERE` with that 32-character checksum. Execute the ENTIRE file as owner. It locks bookings briefly, verifies the live baseline against the exported checksum, refuses existing/partial installations, and validates all old rows/functions/EXECUTE grants/RLS/policies/triggers before committing. Lock timeout is 10 seconds; statement timeout 120 seconds. If anything changed since export, do not bypass the guard: download a fresh backup and use its checksum.

Expected output: `PASS: foundation installed; legacy bookings/functions preserved; scheduling OFF`, with preserved booking count. Any SQL error aborts the transaction; do not run a subset. Issue ROLLBACK in the same session if needed before retrying a fully reviewed file. No PostgreSQL password reset or project relink is needed to use the existing SQL Editor. This workspace currently cannot execute hosted SQL itself.

## Step 3: verify and stop

Run `20261118_scheduling_foundation_verify.sql` (read-only). Confirm foundation phase, OFF state, empty scheduling tables, unchanged legacy routine definitions/permissions and no assigned scheduled booking. Review the published existing login/booking behavior. Do not set the application feature flag; this foundation deliberately does not implement the scheduled API or flight execution.

## Rollback

`20261118_scheduling_foundation_rollback.sql` is transactional and deliberately restricted to an inactive, EMPTY foundation. It refuses any row in the new tables or any non-null scheduled booking, and uses RESTRICT rather than CASCADE. It removes only the foundation objects/nullable field and preserves ALL current old-style bookings, including records created after installation. It does not restore the baseline over newer real records or rename/replace legacy functions. If later schema dependencies exist, PostgreSQL rejects the rollback instead of dropping them.

`btree_gist` is intentionally retained on rollback because it could be shared by another feature. An installation with scheduling data or later cutover requires a separate reviewed recovery plan, not a forced destructive rollback.

## Isolated test evidence

`tests/scheduling/test_production_foundation.py` runs against inspected/labelled private Docker containers, real Supabase GoTrue/Kong/PostgREST, PostgreSQL 17 and all 49 repository migrations. It accepts no hosted DSN/URL. It verifies missing/wrong/stale backup rejection, atomic post-DDL failure, preservation of bookings and three legacy functions/EXECUTE grants, OFF state, denied client access, real legacy booking/dispatch creation, refusal to delete new data, and rollback preserving a booking created after foundation installation.

This is not an authorization to auto-run SQL in production. The candidate and test results must be reviewed, and the scoped backup retained first. No changes in this directory have been applied to the hosted database during preparation.

## Next candidate: prepared/OFF scheduled-booking cutover

See [the cutover review](../../docs/11-release/SCHEDULING_CUTOVER_REVIEW_20261118.md). Foundation and cutover are distinct operations.

1. Read-only `supabase/review/20261118_scheduling_cutover_backup.sql`: save the whole CSV privately; share only backup_checksum.
2. Substitute that fresh checksum in `20261118_scheduling_cutover_prepare.sql`. Preparation keeps the old booking functional and DB mode OFF, preserves original routine identities privately and installs authoritative mode/write controls. It creates no real timetable or fleet rules.
3. Run `20261118_scheduling_cutover_verify.sql`; use this rather than the older foundation comparator after wrappers are installed.
4. Review/publish the new application dual-gate code before changing any Vercel flag. Configuration and owner-only `20261118_scheduling_cutover_activate.sql` are separate reviewed steps. Do NOT run activation now just because preparation succeeded.
5. `20261118_scheduling_cutover_rollback.sql` is deliberately limited to an EMPTY prepared/OFF cutover; it restores exact original routine identities/grants without deleting old bookings. It refuses after new configuration/data or activation. No destructive override is included.

New actual/simulated flight execution is not enabled by this candidate. No real fleet timings, schedules or aircraft changes are seeded by any of these scripts.

## Verified hosted status

The owner applied foundation and supplied verification CSVs on 18 November: 10 bookings preserved, foundation/OFF, new tables empty, legacy routine grants unchanged. The owner subsequently applied cutover preparation and verified prepared/OFF plus all four protection checks. Cutover activation has NOT run; fleet timing rules and the timetable remain to be reviewed.
