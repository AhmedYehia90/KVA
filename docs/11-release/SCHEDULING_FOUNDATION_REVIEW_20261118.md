# Production foundation candidate — 18 November 2026

Status: foundation was applied by the owner in the existing hosted SQL Editor and verified by result CSVs: 10 bookings preserved, foundation/OFF, empty new tables, unchanged legacy routines/permissions. Its source artifacts remain local and were not committed/pushed/deployed by this preparation task. Published web version remains 286bee0 with scheduled bookings disabled.

The owner's uploaded preflight confirmed PostgreSQL 17.6, btree_gist availability, no scheduling tables, 10 historical bookings (9 completed/1 closed), zero active bookings and 25 active aircraft with known locations. All three supplied live booking/progress function bodies matched the repository definitions previously tested. This preflight was not a backup and did not fully enumerate effective grants. The foundation therefore captures the actual live ACLs in a fresh scoped backup and does not change any old booking ACL or RLS policy.

## Concrete artifacts

- `supabase/review/20261118_scheduling_foundation_backup.sql`: read-only single-row scoped baseline export; actual booking data stays in the owner's private off-server CSV. Only the checksum needs sharing.
- `supabase/production/20261118_scheduling_foundation.sql`: additive, transaction-protected foundation. Requires a matching export checksum, refuses partial/repeated installs, preserves old routines and grants, and keeps scheduling OFF with no new RPCs/client table grants.
- `supabase/production/20261118_scheduling_foundation_verify.sql`: read-only verification of phase/OFF/empty new tables and unchanged legacy routines/grants.
- `supabase/production/20261118_scheduling_foundation_rollback.sql`: refuses new scheduling data and preserves all current legacy records rather than restoring an old snapshot over them.
- `supabase/production/README.md`: exact operator sequence and scope/limits.

## Tests completed

Fresh private Docker stack: real GoTrue v2.180.0, Kong 2.8.1, PostgREST v12.2.12 and PostgreSQL 17; all 49 repository migrations applied. No production credentials/data were used. The candidate, not the disruptive staging cutover, was executed.

1. Missing/wrong backup fingerprint rejects install without mutation.
2. A booking change after export makes the old fingerprint invalid.
3. Injected failure after all DDL rolls back every new table/field and leaves original data untouched.
4. Correct backup installs and preserves every old booking field and all three legacy routines/EXECUTE ACLs.
5. Scheduling is constrained OFF; repeat application is safely refused.
6. Real role/PostgREST tests deny new table/private manifest access; no scheduled RPC bypass exists.
7. The actual existing book_route RPC works through Auth -> Kong -> PostgREST -> full schema after installation, creating a real test booking and numbered dispatch.
8. Rollback refuses even a nonempty new rules table, preserving its row.
9. Empty-foundation rollback succeeds and preserves every current old-style booking, including the new booking made AFTER installation. Legacy functions and real authenticated booking reads still work.

Evidence log: `/tmp/kva-foundation-results.log`. Test command: `python tests/scheduling/test_production_foundation.py` after provisioning the fresh isolated full-schema stack. This test never accepts a hosted database address. No web source changed, so the release's prior 88-test/build result is not presented as newly rerun for SQL-only changes.

## What remains

The existing production connection is API-only; no authorized SQL/DDL tool, PostgreSQL DSN or management token is supplied. The next operator action is READ ONLY: export and privately retain the scoped backup, then share only backup_checksum. That permits binding the candidate to the current live baseline. Do not upload booking data here, reset a database password, relink the project, apply staging SQL, or enable the Vercel flag.

This foundation is not scheduled-flight activation or autopilot. A subsequent separately reviewed cutover must protect the shared aircraft resource ledger against legacy booking paths before granting scheduled APIs or enabling the feature.

## Next candidate

See SCHEDULING_CUTOVER_REVIEW_20261118.md for the separately prepared/OFF cutover and its isolated test results. That candidate has NOT been applied to production.
