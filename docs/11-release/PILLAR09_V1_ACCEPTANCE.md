# Pillar 09 — Museum & History v1.0 — Acceptance Checklist

Pillar 09 is reviewed as one complete pillar.

## Automated / build checks

- [ ] Final package verifier passes
- [ ] `pnpm build` passes
- [ ] Supabase `db push --dry-run` shows only the expected final migration
- [ ] Final migration applies successfully

## Pilot Museum

- [ ] `/pilot/history` opens
- [ ] Career summary is correct
- [ ] rank displays a human-readable name
- [ ] first completed operation is correct
- [ ] most-flown aircraft type is correct
- [ ] event legacy is correct
- [ ] timeline renders real evidence

## Airline Museum

- [ ] `/pilot/history/company` opens
- [ ] derived records render with `DERIVED`
- [ ] curated records render with `CURATED`
- [ ] pilot ↔ airline connection values are correct
- [ ] no route/fleet authority is implied

## Museum Curator

- [ ] `/operations/history` is Operations-authorized
- [ ] Create Draft works
- [ ] Edit works
- [ ] Publish works
- [ ] Return to Draft works
- [ ] Curator Audit records writes
- [ ] no `NEXT_REDIRECT` error banner
- [ ] published item appears in Airline Museum

## Living Memories

- [ ] `/pilot/history/memories` opens
- [ ] journey age displays
- [ ] memory source count is non-zero when evidence exists
- [ ] Anniversary Calendar shows real future occurrences
- [ ] On This Day remains empty when no anniversary really falls today
- [ ] no fabricated historical date is introduced
- [ ] a dated published curated entry can participate in future anniversaries

## Navigation

- [ ] authenticated Header contains `History`
- [ ] Operations Center contains `Open Museum Curator`
- [ ] Pilot Museum can open Living Memories / Airline Museum
- [ ] Airline Museum can open Pilot Museum / Living Memories

## Integrity

- [ ] Pilot wallet unchanged by Museum browsing
- [ ] Company KVC unchanged by Museum browsing
- [ ] Economy Ledger unchanged by Museum browsing
- [ ] Fleet count/state unchanged by Museum browsing
- [ ] Route activation unchanged
- [ ] PIREP state unchanged
- [ ] Career XP/rank unchanged by Museum browsing

## Acceptance

When all checks above pass and the full pillar is visually accepted:

`Pillar 09 — Museum & History = APPROVED`

Only then move to Pillar 10.
