-- PRODUCTION FOUNDATION ONLY: no scheduling RPC, no change to legacy functions.
-- First export 20261118_scheduling_foundation_backup.sql privately; paste its
-- checksum into the SET LOCAL below. Do not run with an example/empty checksum.
begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
set local time zone 'UTC';
set local search_path=pg_catalog,public,extensions;
set local kva.foundation_backup_checksum='PASTE_BACKUP_CHECKSUM_HERE';

do $$ begin
 if not pg_try_advisory_xact_lock(hashtextextended('kva.scheduling.foundation.v1',0)) then raise exception 'Another foundation change is running'; end if;
 if to_regnamespace('kva_scheduling_private') is not null then raise exception 'Foundation already present: inspect before retrying'; end if;
 if to_regclass('public.scheduled_flights') is not null or to_regclass('public.aircraft_allocations') is not null or to_regclass('public.fleet_scheduling_rules') is not null
   or exists(select 1 from pg_attribute where attrelid='public.flight_bookings'::regclass and attname='scheduled_flight_id' and not attisdropped) then
   raise exception 'Unexpected existing scheduling schema; no changes applied'; end if;
end $$;
lock table public.flight_bookings in access exclusive mode;
create temporary table kva_foundation_baseline on commit drop as
select jsonb_build_object(
 'format_version',1,
 'database',current_database(),
 'server_version',current_setting('server_version'),
 'bookings',coalesce((select jsonb_agg(to_jsonb(b) order by b.id) from public.flight_bookings b),'[]'::jsonb),
 'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
   from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
   where a.attrelid='public.flight_bookings'::regclass and a.attnum>0 and not a.attisdropped),
 'rls',(select jsonb_build_object('enabled',relrowsecurity,'forced',relforcerowsecurity,'acl',relacl::text) from pg_class where oid='public.flight_bookings'::regclass),
 'policies',coalesce((select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where schemaname='public' and tablename='flight_bookings'),'[]'::jsonb),
 'indexes',coalesce((select jsonb_agg(jsonb_build_object('name',indexname,'definition',indexdef) order by indexname) from pg_indexes where schemaname='public' and tablename='flight_bookings'),'[]'::jsonb),
 'constraints',coalesce((select jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid)) order by conname) from pg_constraint where conrelid='public.flight_bookings'::regclass),'[]'::jsonb),
 'triggers',coalesce((select jsonb_agg(jsonb_build_object('name',tgname,'enabled',tgenabled,'definition',pg_get_triggerdef(oid)) order by tgname) from pg_trigger where tgrelid='public.flight_bookings'::regclass and not tgisinternal),'[]'::jsonb),
 'column_grants',coalesce((select jsonb_agg(to_jsonb(g) order by grantor,grantee,column_name,privilege_type,is_grantable) from information_schema.column_privileges g where table_schema='public' and table_name='flight_bookings'),'[]'::jsonb),
 'legacy_functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text) order by p.proname)
   from pg_proc p where p.oid in (to_regprocedure('public.book_route(uuid)'),to_regprocedure('public.advance_flight_booking(uuid)'),to_regprocedure('public.advance_flight_operation(uuid)')))
) as payload;
do $$ begin
 if current_setting('kva.foundation_backup_checksum',true) !~ '^[a-f0-9]{32}$' or
    current_setting('kva.foundation_backup_checksum',true) is distinct from (select md5(payload::text) from kva_foundation_baseline) then
   raise exception 'Backup checksum missing or baseline changed. Export a fresh backup before retrying'; end if;
end $$;

create schema kva_scheduling_private;
revoke all on schema kva_scheduling_private from public,anon,authenticated,service_role;
create table kva_scheduling_private.foundation_manifest (
 singleton boolean primary key default true check(singleton),
 version integer not null check(version=1),
 applied_at timestamptz not null default now(),
 backup_checksum text not null,
 phase text not null default 'foundation' check(phase='foundation'),
 scheduling_enabled boolean not null default false check(not scheduling_enabled),
 extension_preexisting boolean not null,
 baseline jsonb not null
);
revoke all on kva_scheduling_private.foundation_manifest from public,anon,authenticated,service_role;
insert into kva_scheduling_private.foundation_manifest(version,backup_checksum,extension_preexisting,baseline)
select 1,md5(payload::text),exists(select 1 from pg_extension where extname='btree_gist'),payload from kva_foundation_baseline;
create extension if not exists btree_gist with schema extensions;
create table public.fleet_scheduling_rules (
  fleet_type_id uuid primary key references public.fleet_types(id),
  preparation_minutes integer not null check(preparation_minutes between 0 and 1440),
  turnaround_minutes integer not null check(turnaround_minutes between 0 and 1440)
);
create table public.scheduled_flights (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id),
  flight_number text not null,
  fleet_type_id uuid not null references public.fleet_types(id),
  departure_airport_id uuid not null references public.airports(id),
  arrival_airport_id uuid not null references public.airports(id),
  departure_at timestamptz not null,
  arrival_at timestamptz not null,
  display_timezone text not null,
  preparation_minutes integer not null check(preparation_minutes between 0 and 1440),
  turnaround_minutes integer not null check(turnaround_minutes between 0 and 1440),
  status text not null default 'published' check(status in ('published','cancelled')),
  created_at timestamptz not null default now(),
  check(arrival_at>departure_at),
  check(departure_airport_id<>arrival_airport_id)
);
create unique index scheduled_occurrence_identity on public.scheduled_flights(flight_number,departure_at) where status='published';
create table public.aircraft_allocations (
  id uuid primary key default gen_random_uuid(),
  scheduled_flight_id uuid references public.scheduled_flights(id),
  aircraft_id uuid not null references public.aircraft(id),
  allocation_kind text not null default 'flight' check(allocation_kind in ('flight','maintenance')),
  reason text,
  occupied_during tstzrange not null,
  released_at timestamptz,
  check((allocation_kind='flight' and scheduled_flight_id is not null) or
    (allocation_kind='maintenance' and scheduled_flight_id is null and reason is not null and length(trim(reason))>0)),
  exclude using gist(aircraft_id with =, occupied_during with &&) where(released_at is null)
);
create unique index one_active_aircraft_per_schedule on public.aircraft_allocations(scheduled_flight_id) where released_at is null;
alter table public.flight_bookings add column scheduled_flight_id uuid references public.scheduled_flights(id);
create unique index one_active_pilot_per_schedule on public.flight_bookings(scheduled_flight_id)
where scheduled_flight_id is not null and status in ('booked','boarding','departed','enroute','landed');

alter table public.fleet_scheduling_rules enable row level security;
alter table public.scheduled_flights enable row level security;
alter table public.aircraft_allocations enable row level security;
revoke all on public.fleet_scheduling_rules,public.scheduled_flights,public.aircraft_allocations from public,anon,authenticated,service_role;

-- Prove full preservation and unchanged legacy routines/policies/grants.
do $$
declare expected jsonb; actual jsonb; item jsonb;
begin
 select payload into expected from kva_foundation_baseline;
 select coalesce(jsonb_agg(to_jsonb(b)-'scheduled_flight_id' order by b.id),'[]'::jsonb) into actual from public.flight_bookings b;
 if actual is distinct from expected->'bookings' then raise exception 'Booking data changed; rolling back'; end if;
 for item in select value from jsonb_array_elements(expected->'legacy_functions') loop
   if pg_get_functiondef(to_regprocedure(item->>'signature')) is distinct from item->>'definition'
     or (select proacl::text from pg_proc where oid=to_regprocedure(item->>'signature')) is distinct from item->>'acl' then
       raise exception 'Legacy function or permissions changed; rolling back'; end if;
 end loop;
 if (select coalesce(jsonb_agg(to_jsonb(p) order by policyname),'[]'::jsonb) from pg_policies p where schemaname='public' and tablename='flight_bookings') is distinct from expected->'policies' then
   raise exception 'Legacy booking policies changed'; end if;
 if (select jsonb_build_object('enabled',relrowsecurity,'forced',relforcerowsecurity,'acl',relacl::text) from pg_class where oid='public.flight_bookings'::regclass) is distinct from expected->'rls' then
   raise exception 'Legacy booking RLS/ACL changed'; end if;
 if (select coalesce(jsonb_agg(jsonb_build_object('name',tgname,'enabled',tgenabled,'definition',pg_get_triggerdef(oid)) order by tgname),'[]'::jsonb) from pg_trigger where tgrelid='public.flight_bookings'::regclass and not tgisinternal) is distinct from expected->'triggers' then
   raise exception 'Legacy booking triggers changed'; end if;
 if exists(select 1 from public.flight_bookings where scheduled_flight_id is not null) then raise exception 'Unexpected scheduled booking'; end if;
end $$;
select 'PASS: foundation installed; legacy bookings/functions preserved; scheduling OFF' as result,
 (select count(*) from public.flight_bookings) as preserved_bookings;
notify pgrst,'reload schema';
commit;
