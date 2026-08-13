# Pillar 10 — Living Airports v1.0 — Acceptance Checklist

Review Pillar 10 as one complete pillar.

## Build / migration

- [ ] Final verifier passes
- [ ] `pnpm build` passes
- [ ] `supabase db push --dry-run` shows only the Pillar 10 migration
- [ ] Pillar 10 migration applies successfully

## Living Airports World

- [ ] `/airports` opens
- [ ] connected airport count is correct
- [ ] airport cards render stored airport identity
- [ ] local airport clocks render
- [ ] active routes count is plausible
- [ ] fleet presence reflects recorded `current_airport_id`
- [ ] KVA OS Pulse is visible and clearly described as platform activity

## Airport detail

- [ ] `/airports/HECA` opens
- [ ] airport identity is correct
- [ ] Live Airport Board handles zero/live flights correctly
- [ ] ground fleet renders
- [ ] route network renders
- [ ] Global Aviation Event links render when applicable
- [ ] Route Support interest renders when applicable
- [ ] pilot airport history renders
- [ ] recent completed airport activity renders

## Airport World Console

- [ ] `/operations/airports` is Operations-authorized
- [ ] Create Draft works
- [ ] Edit works
- [ ] Publish works
- [ ] Return to Draft works
- [ ] Close works
- [ ] Audit records writes
- [ ] published notice appears on the target airport page
- [ ] no NEXT_REDIRECT error banner

## World-awareness integrity

- [ ] UI clearly states KVA OS activity != real-world airport status
- [ ] notices are clearly not real-world NOTAM/weather/ATC authority
- [ ] browsing airports does not modify bookings
- [ ] browsing airports does not modify PIREPs
- [ ] browsing airports does not change route activation
- [ ] browsing airports does not move aircraft
- [ ] browsing airports does not change Career XP
- [ ] browsing airports does not change KVC balances
- [ ] browsing airports does not write Economy Ledger
- [ ] browsing airports does not award Global Event credit

## Navigation

- [ ] authenticated Header contains `Airports`
- [ ] Operations Center contains `Open Airport World Console`

## Final project acceptance

When the full pillar is visually and functionally accepted:

`Pillar 10 — Living Airports = APPROVED`

Then:

`KVA OS = 10 / 10 CORE PILLARS COMPLETED`
