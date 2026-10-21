# Install KVA Flight Events Integration Pack v1.0

Extract this package outside the KVA repository.

From PowerShell inside the extracted package:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install-flight-events.ps1 -RepoRoot "E:\Ahmed\game\kalabsha airline\KVA"
```

Then from the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm event:typecheck
pnpm event:test
pnpm event:build
pnpm build
```

Preview the linked Supabase migration:

```powershell
npx supabase db push --dry-run
```

After reviewing the migration list:

```powershell
npx supabase db push
```

Finally:

```powershell
git status
git add apps/web/app/pilot/bookings packages/event-core supabase/migrations docs
git commit -m "feat: integrate flight workflow with Event Core"
git push origin main
```
