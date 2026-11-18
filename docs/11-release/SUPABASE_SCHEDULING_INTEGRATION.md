# Real Supabase scheduling integration — 10 November 2026

## Result and scope

The phase-one booking path was tested end to end against **real local Supabase core services**, not the earlier Auth/PostgREST adapter:

- Official Supabase GoTrue `v2.180.0` for user creation, JWT sessions, password sign-in and user validation.
- Official PostgREST `v12.2.12` for REST reads/writes, PostgreSQL role switching, RLS and scheduling RPCs.
- Kong `2.8.1` for the actual `/auth/v1` and `/rest/v1` gateway and API-key validation.
- PostgreSQL 17 with `pgcrypto`, `uuid-ossp`, `btree_gist` and the complete **49 repository migration files**, including existing triggers, RPCs, event consumers, profile restrictions and passport hardening. A digest manifest is kept privately with the local environment.

These are disposable local test versions, not a proposed production infrastructure deployment. Storage, Realtime, email delivery, OAuth/IVAO and cloud-provider management were not needed or represented as tested. This is not a hosted Supabase staging project or a verification of every manual change that may exist in production.

No production credentials/data were used. No hosted SQL, production settings, commit, GitHub push or Vercel deployment was performed. All synthetic users, passwords, JWTs and service keys remain outside Git in a private directory at `/workspace/kva-supabase-integration` (0700; credential files 0600). The application child process strips injected production Supabase/KVA/database/Vercel/SMTP/IVAO configuration and receives only local test credentials.

## Isolation and environment findings

The official CLI's full PostgreSQL image could not be provisioned efficiently with this workspace's Docker VFS storage driver: its layered extraction approached the disk limit. The pull was stopped and partial download storage reclaimed. Instead, the actual lightweight Auth/PostgREST/Kong services and PostgreSQL were provisioned on a dedicated **internal Docker network**, with synthetic data only. There is no mocked API in these integration/browser checks.

The gateway is addressed at its inspected private Docker bridge IP because this sandbox did not expose the requested localhost port mapping. Tests verify both the container isolation label and exact private gateway address; no arbitrary remote URL/DSN is accepted. PostgreSQL has no published host port. HTTP proxies are disabled for these private integration requests, without disabling TLS verification for external services.

## Passing real API tests

1. Real Auth creates and signs in a synthetic active administrator, two active pilots and a pending pilot. The real auth profile-creation triggers run.
2. Installing the stage preserves every pre-existing booking, profile and aircraft field. Legacy bookings receive no invented dates.
3. Staff-only fleet rules, real scheduling RPCs, aircraft maintenance/unknown location, airport continuity, preparation/turnaround intervals and dependent cancellation behave as expected.
4. Real PostgREST RLS/ACL prevent anonymous/pilot administration; users read only their own booking.
5. Two simultaneous HTTP booking requests for one occurrence yield exactly one winner, one numbered dispatch and one event, without partial writes from the failed request.
6. Another pilot cannot cancel that booking. Pending pilots, old `book_route`, direct writes and legacy progress-wrapper bypasses cannot create/execute a scheduled flight.
7. Actual API cancellation preserves history, and another real authenticated test pilot can rebook the same occurrence.
8. Two simultaneous HTTP allocations cannot use the same aircraft in overlapping intervals.
9. One pilot racing to book two different occurrences obtains only one active booking.
10. Future maintenance shares the same overlap exclusion; pilots cannot release it. Staff release, successful rescheduling/reassignment and cancellation work through actual REST RPCs.
11. Existing full-schema event consumers do not change aircraft positions, create operational projections or inflate pilot flight/hour totals for these scheduling events. The schedule projection excludes pilot identities and emails.

A real-stack nuance was handled in the assertions: a DELETE filtered to zero rows by RLS may return HTTP 204 rather than 403. The test checks that the record actually survives; HTTP status alone is not treated as evidence of deletion or permission.

## Passing real browser tests

The production-mode KVA build connects directly to that gateway. No intercepted requests or synthetic Auth API responses are used.

- Anonymous schedule request redirects to login.
- Arabic and English, each at 390px and 1440px: password sign-in through the actual login form and Auth service; legacy-list redirect; dated-flight listing; booking; existing booking detail with real FK/dispatch joins; cancellation; persisted cancelled history verified through real REST reads.
- Correct Arabic RTL/English LTR, no horizontal overflow and no page JavaScript errors in the tested paths.
- The old detail view exposed a Start Flight button despite phase one refusing execution at the database. It was corrected behind the scheduling flag: scheduled bookings show a localized unavailable-execution message instead. The real browser suite verifies the start button is absent; server-side execution guards remain in place. The runner also now refuses an occupied test port, checks that its own server remains alive during readiness, and stops the complete child process group so stale servers cannot produce false test results.

Fresh `pnpm verify` passes **88 tests**, typecheck, lint and the production build under the local Supabase configuration. An existing autoprefixer warning in the fleet CSS remains unrelated; no blocking failure was observed in the tested booking paths.

## Reproduction

From the repository root, with Docker and Python Playwright/Chromium available:

```sh
python tests/scheduling/local_supabase.py
python tests/scheduling/test_supabase_integration.py
python tests/scheduling/test_supabase_browser.py
```

`local_supabase.py` provisions a new disposable labelled stack. If the verified synthetic stack already exists, `--reset-test-schema` resets ONLY its public and private scheduling test schemas and reapplies the 49 repository files; it does not accept a remote database or reset production. Test Auth users in that throwaway instance may remain between schema resets; each suite creates new synthetic users.

The browser runner rebuilds using the local public URL/key. `--reuse-build` is only for rerunning browser checks when the application source AND local public configuration are unchanged. The generated `.next` directory is a local test artifact and must never be uploaded as a production build.

Evidence logs:

- `/tmp/kva-supabase-schema.log`
- `/tmp/kva-real-supabase-api-tests.log`
- `/tmp/kva-real-supabase-browser-tests.log`
- `/tmp/kva-real-supabase-web.log`

## Review boundary

Changes remain local and uncommitted for the owner's review. This success does not authorize applying the staging-only SQL to production. Before a production rollout, separately review the production migration/cutover and recovery plan, actual legacy bookings and aircraft locations, approved turnaround rules and production configuration. Automatic/simulated flight execution and IVAO accounting remain outside phase one.
