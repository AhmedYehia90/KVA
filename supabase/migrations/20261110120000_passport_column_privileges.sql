-- Preserve every existing row. Apply through an authorized SQL connection.
begin;

alter table public.pilot_passports enable row level security;
revoke all privileges on table public.pilot_passports from public, anon, authenticated;
do $$
declare columns_sql text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum)
    into columns_sql
  from pg_attribute
  where attrelid = 'public.pilot_passports'::regclass
    and attnum > 0 and not attisdropped;
  execute format('revoke all privileges (%s) on table public.pilot_passports from public, anon, authenticated', columns_sql);
end;
$$;

grant select on table public.pilot_passports to authenticated;
-- The existing deployed client also submits updated_at. Accept that column for
-- compatibility, but always replace its value in the database trigger below.
grant update (bio, visibility, updated_at) on public.pilot_passports to authenticated;

-- Keep owner access bounded even if a legacy permissive policy is added.
drop policy if exists passport_owner_select_guard on public.pilot_passports;
create policy passport_owner_select_guard on public.pilot_passports
as restrictive for select to authenticated
using (pilot_id = auth.uid());
drop policy if exists passport_owner_update_guard on public.pilot_passports;
create policy passport_owner_update_guard on public.pilot_passports
as restrictive for update to authenticated
using (pilot_id = auth.uid()) with check (pilot_id = auth.uid());

-- The database owns the effective timestamp; client-supplied values are ignored.
create or replace function public.stamp_pilot_passport_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.stamp_pilot_passport_update() from public, anon, authenticated;
drop trigger if exists stamp_pilot_passport_update on public.pilot_passports;
create trigger stamp_pilot_passport_update
before update on public.pilot_passports
for each row execute function public.stamp_pilot_passport_update();

-- postgres/service_role and existing SECURITY DEFINER issuance routines retain
-- their privileges. No passport is inserted, updated, deleted or made public.
commit;
