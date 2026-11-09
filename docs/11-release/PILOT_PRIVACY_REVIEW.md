# Pilot privacy change — review before release

## Scope and current state

- `/privacy`: public Arabic/English policy, using the existing page classes and locale selector.
- `/regulations`: public rendering of `docs/CONSTITUTION.md`, including all ten original principles and the bilingual Pilot Data Protection & Privacy section. The document is explicitly included in Next.js output tracing.
- Footer: privacy and regulations links; existing styles and authenticated-footer behavior preserved.
- Public passport: callsign replaces full name. An explicit public DTO excludes name, email, user ID and unexpected nested fields, including when an older RPC returns them. Invalid callsigns fall back to a generic pilot label.
- The web changes were published in commit 6aaf294. No live database migration or visibility change was performed by that deployment. See FINAL_SECURITY_READINESS.md for the subsequent application hardening and remaining database verification.

## Access review

| Surface | Finding / intended boundary |
| --- | --- |
| Anonymous direct `profiles` REST read | Current read-only probe returned HTTP 200 with zero rows; no personal values were printed. This is not a complete live policy/grant inventory. |
| `get_public_pilot_passport(text)` | Existing source returns `fullName` through SECURITY DEFINER, bypassing profile RLS for explicitly public passports. The prepared migration removes it at the API boundary. There was no active public passport to demonstrate a live response without changing visibility. |
| Profile self-edit | Existing RLS allows updating one's own row, but does not itself prevent changing `role`, `status` or operational totals when table UPDATE grants exist. The prepared migration replaces legacy table/column grants with SELECT and limited UPDATE grants, and adds restrictive owner/active-staff guards. |
| Public web board / fleet | Reviewed selects/rendering do not publish profile names or emails. The live-flight board uses a server client with explicit operational fields; do not expand it to raw profile objects. |
| Private pilot pages | Name and email access for the authenticated owner remains private, not removed from their account. |
| Operations pages / exports | Sensitive consoles and the replay JSON export use the existing administrator guard. The operations overview requires sign-in and uses caller-context RLS; its owner/staff data boundary must remain intact. Staff role checks in the database and the web admin-email allowlist are separate existing mechanisms. |
| Auxiliary Express API | Only static fleet data and health are exposed; no pilot personal data route was found. |

## Pending database migration

Review `supabase/migrations/20261109120000_pilot_data_privacy.sql` before applying it.
It revokes legacy table and column privileges on profiles for PUBLIC/anon/authenticated,
allows authenticated profile reads subject to RLS, and permits direct edits only to
`full_name`, `country_code` and `avatar_url`. Operational SECURITY DEFINER routines and
service-role grants are preserved. It adds restrictive policies that also constrain
broader legacy permissive policies, and replaces the public passport function with the
same explicit visibility/status filters and public operational summary minus `fullName`.

No profile rows are deleted, and no existing public/private choices are changed.
Direct role/status/email/totals editing through authenticated profile updates will be
blocked; any legitimate administrative role-management workflow must use its authorized
server path. Check current grants, inherited roles, views, triggers and staff workflows
on staging before applying the migration. This migration does not claim to audit every
custom database role or every view that may exist outside the repository.

**Rollout after approval:** apply and verify the reviewed database migration on staging,
then on the intended database, and deploy the web changes. Recheck anonymous RPC output
as well as HTML/RSC. A web-only deployment masks the legacy RPC response in the UI but
cannot remove its fields from callers of the hosted RPC endpoint.

## Verification

- `pnpm --filter @kalabsha/web test:privacy`: DTO allowlisting, malformed identity handling,
  preservation of the original constitution, bilingual privacy clauses and policy text.
- `pnpm verify`: existing type checks, tests, lint and production build.
- Browser checks use an isolated local Supabase-compatible fixture with deliberately
  private names/emails in its legacy RPC response. Check both locales at phone and desktop
  widths, footer navigation, HTML/RSC absence of personal values, public aliases and 404
  for a private passport. No real passport visibility is changed.
- PostgreSQL integration uses in-memory PGlite with fake identities, deliberately broad
  legacy grants/policies, and the actual migration. It tests repeat application, anonymous
  denial, owner access, cross-user denial, blocked self-escalation, active/inactive staff,
  public RPC minimization and private/inactive passport denial. This does not simulate
  Supabase JWT issuance or every production schema dependency.

To reproduce the optional isolated SQL checks without adding a product dependency:

```sh
npm install --prefix /tmp/kva-privacy-db --cache /workspace/.cache/npm --ignore-scripts --no-audit --no-fund @electric-sql/pglite
KVA_PRIVACY_PGLITE_MODULE=file:///tmp/kva-privacy-db/node_modules/@electric-sql/pglite/dist/index.js node apps/web/tests/privacy-database.mjs
```

Before publishing policy text, confirm the administration contact channel and actual
retention practices. The policy intentionally invents neither an email address nor a
fixed retention period, and does not promise automatic account deletion.
