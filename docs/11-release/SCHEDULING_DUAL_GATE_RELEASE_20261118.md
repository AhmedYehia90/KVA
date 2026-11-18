# Scheduling dual-gate application release — 18 November 2026

The owner authorized continuing with publication after the hosted cutover preparation verified successfully. This release updates the web entry points to require BOTH `KVA_SCHEDULING_PHASE1_ENABLED=true` and actual `scheduling_mode_enabled()=true` from Supabase. Missing/error/false database mode cannot activate scheduled booking. Existing flight selection, legacy booking actions and booking-detail queries keep their existing path while OFF; no Vercel configuration was changed.

## Actual hosted state before release

Owner-applied foundation preserved ten historic bookings. Owner-applied cutover preparation and the subsequent verification CSV report prepared/OFF, unchanged archived routine sources/config, preserved public EXECUTE grants, blocked client archive calls and enabled booking guard. A fresh read-only call to the actual production mode RPC returned false before publication. The new SQL files are recorded as history/recovery artifacts, not automatically applied during web build/deploy. No new hosted SQL or booking/timetable mutations are part of this publication.

## Validation and publication

The source passed the isolated real Supabase cutover suite, including in-flight legacy booking versus activation, own booking/cancellation, shared-aircraft allocation races, exact function-identity/ACL restoration and rollback refusal after use. The browser matrix covered real Auth/API in Arabic/English at 390/1440 px with both application-ON/database-OFF and activated local mode. A fresh repository verification is required before pushing; production must then report the exact Git SHA in X-KVA-Revision. A successful Git push alone is not deployment verification.

Private backup CSVs, bound operator SQL, local service tokens and user attachments are outside the checkout and are NOT included in this release. Production SQL templates retain checksum placeholders. No automatic migration/activation exists in CI or the web build script.

## Remaining activation inputs

No real fleet preparation/turnaround minutes, flight dates/timezone or aircraft rotation plan were invented. These must be agreed and validated before owner activation. The private activation function refuses active old bookings, an empty/stale/unallocated timetable or unavailable/mislocated aircraft. Scheduled flight execution/autopilot and IVAO accounting remain outside this first booking phase; publishing this source does not enable them.

The previously documented indirect picomatch advisory has no new fix introduced by this change; dependency versions and lockfile are unchanged. No clean-audit claim is made.

## Pre-publication checks completed

Fresh pnpm verify passed 90 tests, types, lint and production build with the production feature flag unchanged. Actual production scheduling_mode_enabled() returned false. The 28-file candidate scan found no injected server key or real test password values. The isolated real Supabase/API/browser evidence remains recorded in the cutover review.
