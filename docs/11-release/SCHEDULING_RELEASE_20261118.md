# Scheduling code release — 18 November 2026

The owner authorized pushing and deploying the reviewed changes. This release publishes the phase-one application, isolated SQL/test artifacts and the already-applied passport hardening history. It does not activate scheduled bookings or automatic flight execution in production.

## Verified production boundary before publication

The production REST/OpenAPI inventory has no scheduled_flights, aircraft_allocations, fleet_scheduling_rules, book_scheduled_flight or list_scheduled_flights. This workspace has API access only: no PostgreSQL DSN, Supabase management access token, Vercel token or SQL-management connector. Existing API keys do not authorize DDL. No hosted SQL was applied by this release.

Keep KVA_SCHEDULING_PHASE1_ENABLED absent/false in production. Normal route booking retains its existing path. /pilot/schedule remains unavailable until an approved production migration/cutover is executed and the production flag is enabled. Staging SQL deliberately disables old booking/progress paths and MUST NOT be applied to production as-is.

No external service, cron worker, simulated departure or IVAO accounting has been enabled. The earlier separate-table passport repair was already executed by the owner and live-verified; its migration is being recorded in Git, not run again by Vercel. Web build/deploy scripts do not apply database migrations.

## Publication and verification

Run fresh pnpm verify using the existing production configuration with scheduling disabled. Push the reviewed source to main, then verify the production alias serves the exact Vercel Git commit through X-KVA-Revision (added only when VERCEL_GIT_COMMIT_SHA contains a valid 40-character SHA). Check public bilingual legal/auth pages, anonymous private-route denial and the disabled scheduling route. Tokens and passwords must not be logged. Do not infer deployment completion solely from a successful Git push.

## Next concrete activation work

1. Inspect the production baseline with supabase/review/20261118_scheduling_production_preflight.sql (read-only; no pilot names/emails). Review existing live booking routines, policies, indexes, triggers and aggregate readiness. No project relinking or password reset is needed for SQL Editor inspection.
2. With authorized SQL access, obtain/verify a recoverable backup and create a dedicated production migration/cutover that preserves existing bookings and reconciles unknown aircraft locations, busy tails and agreed turnaround rules. Do not invent dates for legacy bookings or disable normal operations prematurely.
3. Test that exact production migration separately, apply only after successful checks, then enable the production flag and verify real booking/cancellation/concurrency. Keep automatic flight execution for its separately reviewed phase.

The current release is code publication, not a claim that the new scheduling feature or autopilot is active on the public website.

## Dependency audit on release day

The production registry audit reports one high advisory, GHSA-fc5q-39xc-vjpf, for picomatch 4.0.7 via next-intl -> @parcel/watcher. The registry's latest picomatch is still 4.0.7 and the advisory has no patched release. Do not describe this audit as clean or suppress the finding. In this repository the dependency is used by next-intl's source-file extraction watcher; experimental extraction is not enabled, and the watcher constructs static ignore patterns internally. No public KVA input-to-glob path was identified in this review. This limits known reachability; it is not a proof that the dependency is defect-free. Track a patched upstream release. No unsupported dependency removal/downgrade or advisory suppression was applied.

## Pre-push results

Fresh repository verification passed 88 tests, type checks, lint and production build. Local production-mode checks using the existing Supabase connection passed real administrator login/logout, legacy flight browsing/bookings, admin database access and public legal/recovery pages. Scheduling remained disabled (404), and private access was denied after logout. No booking/flight/password mutation was submitted. Credential-value scanning of the 24 candidate source/document files found no injected server keys or test passwords.
