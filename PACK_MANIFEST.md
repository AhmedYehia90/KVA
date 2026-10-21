# Pack Manifest

## Pack
KVA Flight Events Integration Pack v1.0

## Adds
- Supabase event-store migration
- Flight event contracts
- Flight contract tests
- Event integration documentation
- Blueprint and release note

## Replaces
- `apps/web/app/pilot/bookings/[id]/actions.ts`
- `packages/event-core/src/index.ts`
- `packages/event-core/package.json`

## Database impact
Additive tables and RPC replacements. Review with `supabase db push --dry-run` before deployment.

## Secrets
None included.
