-- KVA Event Operations Console v1.0
-- Audits privileged projector maintenance actions initiated from the console.

create table if not exists public.operations_console_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text not null,
  action text not null check (
    action in (
      'retry_single_event',
      'retry_failed_events',
      'rebuild_projection'
    )
  ),
  status text not null check (
    status in ('succeeded', 'failed', 'rejected')
  ),
  input jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_operations_console_audit_created
on public.operations_console_audit(created_at desc);

create index if not exists idx_operations_console_audit_actor
on public.operations_console_audit(actor_user_id, created_at desc);

create index if not exists idx_operations_console_audit_action
on public.operations_console_audit(action, created_at desc);

alter table public.operations_console_audit enable row level security;

-- No client-facing policies are created. The server-only Supabase secret client
-- writes and reads this audit trail after application-level administrator checks.
