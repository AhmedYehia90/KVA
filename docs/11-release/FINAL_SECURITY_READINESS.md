# Security and application readiness — 9 November 2026

## Verified data baseline

Read-only counts found one auth account and one active administrator profile, ten bookings,
ten PIREPs, one passport and 200 platform events. There are no ordinary pilot profiles in
that snapshot. This is not an empty database: no records are to be deleted or reset on that
assumption. No test flight, operational action, password change or recovery email was sent
in the live-data browser checks. Normal sign-in/sign-out was exercised with the existing
configured test account; passwords and session tokens were not printed or saved.

## Application fixes

- Authentication callback rejects missing/failed exchanges and only accepts canonical
  same-origin destinations, including encoded redirect attacks. Provider errors are not
  echoed to visitors.
- Sign-in distinguishes unavailable service/rate limits from invalid credentials, validates
  inputs on the server, and retains Arabic/English messages.
- Normal logout revokes only the current browser session. Password-change success uses
  global sign-out, tested with a mocked provider rather than changing a real password.
- Recovery page provides `admin@kvafly.com` as an immediate manual recovery channel.
  Automated recovery sending is OFF unless `KVA_PASSWORD_RECOVERY_ENABLED=true` is set
  after verifying Supabase's email delivery and the authorized return URL:
  `https://kva-web-beta.vercel.app/auth/callback?next=%2Fpilots%2Freset-password`.
  The reset form requires a validated user session and matching passwords of at least
  twelve non-padding characters. Automated provider flows are unit-tested; no recovery
  email was sent and real email delivery is not claimed as verified.
- Sensitive operations pages and the replay export require both the email allowlist and
  an active database staff/admin/dispatcher profile. Missing/error profiles fail closed.
  Header navigation follows the same role boundary and shows a callsign rather than an
  email-derived label.
- The supplied official administration email is linked in the footer, privacy policy,
  recovery and pilot-application surface. Network references explicitly state that they
  do not imply affiliation/approval, and describe integrations as planned.
- Added anti-framing, no-sniff, referrer, form/base restrictions and authentication
  no-store headers without blocking Next.js hydration or same-origin server actions.

## Dependencies and CI

Production audit initially reported 4 critical, 10 high and 7 moderate advisories.
Next.js was patched within the 15.5 line to 15.5.29; compatible workspace dependency
updates include patched image-processing and Express dependencies. Targeted pnpm
overrides replace vulnerable PostCSS 8.x with >=8.5.23 and Prisma's deepmerge-ts 7.x
with 8.x. Prisma Client generation was verified with that override; no migration was
run by that command. The final production dependency audit reports zero known
advisories. This is a registry audit result, not a guarantee that all defects are absent.

Node 24 is declared consistently and CI now installs with the frozen pnpm lockfile,
builds workspace packages, then runs types, tests, lint and web production build.
Existing lint warnings were resolved; the pilot-office image keeps its dimensions and
styles using Next Image. Dependency manifests and the pnpm lockfile are saved together.

## Database work: not applied to the hosted database by this task

The environment currently supplies a Supabase API key, not an authorized PostgreSQL/DDL
connection. `KVA_DATABASE_URL` was requested through secure environment settings. Do not
extract proxy credentials or deploy a generic SQL-execution endpoint to work around it.
Until authorized SQL inspection/application is possible, full database readiness is
**unconfirmed**. Publishing the web application alone does not change hosted RPC output.

Two transactional, repeatable migrations are available:

1. `20261109120000_pilot_data_privacy.sql`: public RPC excludes fullName; restricts profile
   reads/edits, legacy grants and role/status/total self-escalation.
2. `20261109130000_active_pilot_operations.sql`: denies operational writes by pending or
   inactive user accounts, including writes inside SECURITY DEFINER booking RPCs;
   preserves trusted background/service writes and all existing rows.

The actual migrations pass isolated PostgreSQL/PGlite checks including broad legacy
policies, owner/other-user access, active/inactive staff, personal-field removal, private
passport denial, repeat application and active-pilot enforcement. These are not live
schema verification. Before applying, inspect current function definitions, grants,
policies and triggers; if already hardened, avoid unnecessary changes. After applying,
verify public RPC and authenticated grants, and compare the preserved data counts.

## Checks performed

- Full repository `pnpm verify`: type checks, package/web tests, lint and production build.
- Production dependency audit: zero published advisories at the time of the check.
- Prisma Client generation: passed, without connecting to or migrating a database.
- Local production browser: public routes in Arabic/English at phone/desktop widths;
  real administrator login/logout; private pages, existing detail pages, private-passport
  404, admin/export denial for visitors, recovery contact fallback, native validation,
  role-menu behavior and unchanged operation-form values. No operational forms submitted.
- Read-only data counts before/after. No dataset reset or deletion authorized or performed.

## IVAO Egypt application

The public site provides the policy, constitution, official contact and accurate statements
that integrations are planned. Do not claim IVAO approval, working IVAO SSO, telemetry or
registration of a VID. Those are separate provider onboarding/integration steps. Final
technical readiness must not be claimed until hosted database permissions/RPC fields are
verified. IVAO Egypt's current acceptance criteria and the external approval decision
are not established by these application tests. No message or application was sent to IVAO.
