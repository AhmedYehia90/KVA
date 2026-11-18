# Passport privileges correction — 10 November 2026

Status: owner applied the guarded SQL script in the existing hosted Supabase SQL Editor and supplied its PASS result with one preserved row. Post-application live API checks passed on 10 November 2026. No deployment or push performed. This execution environment still has no PostgreSQL DSN or Supabase management token/tool; the DDL was executed by the owner, not through the API key. No project relinking/password reset/new database was needed.

## Evidence and preservation

Owner-supplied exports show RLS enabled, owner-only SELECT/UPDATE policies, no noninternal passport triggers, and broad table/column grants for anon/authenticated. TRUNCATE bypasses row-level policies (this is not a claim of a REST truncate endpoint). Before-fix live authenticated PATCH probes with contradictory predicates accepted administrative columns while matching zero rows. A fresh private export is at `/workspace/kva-backups/passport-20261110T101558Z/pilot_passports.json` (0600, parent 0700). One existing passport; its data matched before/after all live probes. The owner also exported the passport CSV and policies/grants. These are targeted exports, NOT a full PostgreSQL backup. No operational record, visibility, password or issuance field was changed live.

## Implementation

Migration `supabase/migrations/20261110120000_passport_column_privileges.sql` revokes all table and legacy column grants from PUBLIC/anon/authenticated. Grants authenticated SELECT and UPDATE(bio,visibility,updated_at), bounded by restrictive owner policies. No direct INSERT/DELETE/TRUNCATE/TRIGGER/REFERENCES, administrative identity/status/issued_at changes, or anonymous table access. Existing owner permissive policies are preserved. Service_role/postgres permissions and SECURITY DEFINER issuance are retained.

The deployed client submits updated_at with visibility. A trigger always replaces that supplied timestamp with the database clock. Thus it cannot be forged, while the existing website works without a frontend deployment. No row is rewritten during migration. Public passport RPC stays available under its existing execution grants, visibility and active-status checks.

## Checks

- Fresh pnpm verify passed: 84 tests, typecheck, lint and production build. Existing fleet CSS autoprefixer warning remains unrelated.
- Optional isolated PostgreSQL test `apps/web/tests/passport-database.mjs` reproduces pre-fix administrative mutation and anonymous truncate inside rolled-back transactions, applies the actual migration/guarded rollout repeatedly, and verifies complete row preservation.
- After-fix tests deny administrative column updates, INSERT, DELETE, TRUNCATE and trigger privileges; deny anonymous reads/edits and cross-user access even with legacy permissive policies. Owner bio/visibility edits work, client timestamp forgery is overwritten, and trusted service/definer issuance works.
- Test runner: `KVA_PRIVACY_PGLITE_MODULE=file:///tmp/kva-passport-tests/node_modules/@electric-sql/pglite/dist/index.js node apps/web/tests/passport-database.mjs`. PGlite installed outside the repository; no application dependency/lockfile changes.

## Application procedure (completed by owner)

Run `supabase/review/20261110_passport_safe_apply.sql` as postgres in the EXISTING Supabase SQL Editor after keeping the private exports. It is a single transaction with a 10-second lock timeout, a temporary snapshot for full-row equality checks, effective column/table permission checks and preserved service privileges. Any failed assertion aborts the transaction. On failure do not run a partial subset; issue ROLLBACK in the same session if needed and report the error. Successful result says PASS with the preserved row count. This creates no new database and changes no business rows.

After application, rerun live read/no-match administrative PATCH tests (expect 403/42501 for protected fields; owner visibility/legacy timestamp compatibility 200 with zero matched rows), verify anonymous denial and private/public RPC behavior, compare the private snapshot and check the real passport page. Do not claim hosted repair complete until those checks pass. No web deployment is required by this database-only correction.

## Live after-fix verification — completed

- All fields of the single hosted passport exactly matched the private pre-fix snapshot, both before and after testing.
- Anonymous table read: 401/42501. Real administrator login and own-passport read succeeded; test session logout returned 204.
- Contradictory-predicate PATCH attempts for pilot_id, passport_number, public_slug, status and issued_at: 403/42501. No rows matched or changed.
- Bio, visibility, and existing-client visibility+updated_at request shapes: 200 with an empty returned array, proving permission compatibility without changing visibility or testing a real-row timestamp write. Actual timestamp-overwrite semantics were verified in isolated PostgreSQL, not by changing the live record.
- Contradictory-predicate DELETE: 403/42501. Private/inactive passport public RPC returned null.
- Published privacy/login routes available; anonymous passport page redirects to login.
- The guarded SQL PASS result also establishes its in-transaction effective privilege assertions passed, including no TRUNCATE/TRIGGER/DELETE for anon/authenticated and preserved service_role privileges. No live destructive TRUNCATE test was attempted.

Scope: this verifies the passport-table correction, not final readiness of every Supabase table or password-recovery email delivery. The migration, guarded SQL and test are stored locally in the checkout; no GitHub push or Vercel deployment was necessary for this database-only correction.
