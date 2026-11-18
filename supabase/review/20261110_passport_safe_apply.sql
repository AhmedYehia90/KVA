-- Reviewed production application: run as postgres in the existing Supabase SQL Editor.
-- No password reset, new database, deployment or business-row mutation.
-- Existing exported CSVs must be kept privately for recovery.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';
lock table public.pilot_passports in share row exclusive mode;
create temporary table passport_before_hardening on commit drop
as select * from public.pilot_passports;



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

-- Fail the transaction if any row/field changed or effective privileges remain unsafe.
do $$
declare role_name text; col record;
begin
  if exists (
    (select * from public.pilot_passports except all select * from passport_before_hardening)
    union all
    (select * from passport_before_hardening except all select * from public.pilot_passports)
  ) then raise exception 'Passport data changed; refusing to commit'; end if;
  if not (select relrowsecurity from pg_class where oid='public.pilot_passports'::regclass)
    then raise exception 'RLS is not enabled'; end if;
  foreach role_name in array array['anon','authenticated'] loop
    if has_table_privilege(role_name,'public.pilot_passports','TRUNCATE')
       or has_table_privilege(role_name,'public.pilot_passports','TRIGGER')
       or has_table_privilege(role_name,'public.pilot_passports','DELETE')
      then raise exception 'Unsafe table privileges remain for %',role_name; end if;
    for col in select attnum,attname from pg_attribute
      where attrelid='public.pilot_passports'::regclass and attnum>0 and not attisdropped
    loop
      if has_column_privilege(role_name,'public.pilot_passports',col.attnum,'INSERT')
         or has_column_privilege(role_name,'public.pilot_passports',col.attnum,'REFERENCES')
        then raise exception 'Unsafe column privileges remain for %',role_name; end if;
      if has_column_privilege(role_name,'public.pilot_passports',col.attnum,'UPDATE')
         is distinct from (role_name='authenticated' and col.attname in ('bio','visibility','updated_at'))
        then raise exception 'Unexpected UPDATE privilege for %.%',role_name,col.attname; end if;
      if has_column_privilege(role_name,'public.pilot_passports',col.attnum,'SELECT')
         is distinct from (role_name='authenticated')
        then raise exception 'Unexpected SELECT privilege for %.%',role_name,col.attname; end if;
    end loop;
  end loop;
  for col in select unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) as privilege loop
    if not has_table_privilege('service_role','public.pilot_passports',col.privilege)
      then raise exception 'Expected service role privilege missing: %',col.privilege; end if;
  end loop;
end;
$$;
select 'PASS: privileges hardened; all existing passport data preserved' as result,
       (select count(*) from public.pilot_passports) as passport_rows;
commit;
