-- PREPARE ONLY. Keeps database mode OFF and legacy booking operational.
-- Save the cutover backup off-server before replacing the checksum below.
begin;
set local lock_timeout='10s';set local statement_timeout='120s';
set local time zone 'UTC';set local search_path=pg_catalog,public,extensions;
set local kva.cutover_backup_checksum='PASTE_CUTOVER_BACKUP_CHECKSUM_HERE';
select pg_advisory_xact_lock(hashtextextended('kva.scheduling.foundation.v1',0));
select pg_advisory_xact_lock(hashtextextended('kva.scheduling.cutover.v1',0));
lock table public.flight_bookings in access exclusive mode;
do $$begin
 if not exists(select 1 from kva_scheduling_private.foundation_manifest where version=1 and phase='foundation' and not scheduling_enabled) then raise exception 'Inactive verified foundation required';end if;
 if to_regclass('kva_scheduling_private.cutover_backup') is not null then raise exception 'Cutover already prepared';end if;
 if exists(select 1 from public.scheduled_flights) or exists(select 1 from public.aircraft_allocations) or exists(select 1 from public.fleet_scheduling_rules) then raise exception 'Initial cutover preparation requires empty foundation tables';end if;
end $$;
create temporary table kva_cutover_baseline on commit drop as
select jsonb_build_object('format_version',2,'foundation',(select to_jsonb(m) from kva_scheduling_private.foundation_manifest m),'rules',coalesce((select jsonb_agg(to_jsonb(r) order by fleet_type_id) from public.fleet_scheduling_rules r),'[]'::jsonb),'schedules',coalesce((select jsonb_agg(to_jsonb(s) order by id) from public.scheduled_flights s),'[]'::jsonb),'allocations',coalesce((select jsonb_agg(to_jsonb(a) order by id) from public.aircraft_allocations a),'[]'::jsonb),'legacy_baseline',(select jsonb_build_object(
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
))) as payload;
do $$declare proc_row record;begin
 if current_setting('kva.cutover_backup_checksum',true) !~ '^[a-f0-9]{32}$' or current_setting('kva.cutover_backup_checksum',true) is distinct from (select md5(payload::text) from kva_cutover_baseline) then raise exception 'Cutover backup missing or stale';end if;
 for proc_row in select p.* from pg_proc p where p.oid in ('public.book_route(uuid)'::regprocedure,'public.advance_flight_booking(uuid)'::regprocedure,'public.advance_flight_operation(uuid)'::regprocedure) loop
  if pg_get_userbyid(proc_row.proowner)<>current_user or proc_row.proacl is null then raise exception 'Unsupported function owner/default ACL: review before cutover';end if;
  if exists(select 1 from aclexplode(proc_row.proacl) a where a.grantor<>proc_row.proowner) then raise exception 'Custom grantor requires explicit review';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements((select baseline->'legacy_functions' from kva_scheduling_private.foundation_manifest)) f where pg_get_functiondef(to_regprocedure(f->>'signature')) is distinct from f->>'definition' or (select proacl::text from pg_proc where oid=to_regprocedure(f->>'signature')) is distinct from f->>'acl') then raise exception 'Legacy routines drifted since foundation';end if;
end $$;
create table kva_scheduling_private.cutover_backup (
 singleton boolean primary key default true check(singleton),backup_checksum text not null,baseline jsonb not null,legacy_proc jsonb not null,created_at timestamptz not null default now()
);
revoke all on kva_scheduling_private.cutover_backup from public,anon,authenticated,service_role;
insert into kva_scheduling_private.cutover_backup(backup_checksum,baseline,legacy_proc)
select md5(payload::text),payload,(select jsonb_agg(jsonb_build_object('oid',p.oid,'name',p.proname,'source',p.prosrc,'config',p.proconfig,'acl',p.proacl::text) order by p.proname) from pg_proc p where p.oid in ('public.book_route(uuid)'::regprocedure,'public.advance_flight_booking(uuid)'::regprocedure,'public.advance_flight_operation(uuid)'::regprocedure)) from kva_cutover_baseline;
alter table kva_scheduling_private.foundation_manifest drop constraint foundation_manifest_phase_check,drop constraint foundation_manifest_scheduling_enabled_check;
alter table kva_scheduling_private.foundation_manifest add constraint foundation_manifest_phase_check check(phase in ('foundation','prepared','scheduled_booking')),add constraint foundation_manifest_scheduling_enabled_check check(scheduling_enabled=(phase='scheduled_booking'));
update kva_scheduling_private.foundation_manifest set phase='prepared';

create function public.scheduling_mode_enabled() returns boolean language sql security definer set search_path='' as $$
 select coalesce((select scheduling_enabled from kva_scheduling_private.foundation_manifest where phase='scheduled_booking'),false)
$$;
revoke all on function public.scheduling_mode_enabled() from public,anon,authenticated,service_role;
grant execute on function public.scheduling_mode_enabled() to anon,authenticated,service_role;

-- Preserve effective/ordered EXECUTE ACLs when wrapping/restoring old routines.
create function kva_scheduling_private.restore_execute_acl(target regprocedure,saved text) returns void language plpgsql set search_path='' as $$
declare a record;item record;role_sql text;begin
 for a in select distinct x.grantee from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x where p.oid=target and x.grantee<>p.proowner loop
  role_sql:=case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end;
  execute format('revoke all on function %s from %s',target,role_sql);
 end loop;
 for item in select v from unnest(saved::aclitem[]) with ordinality t(v,n) order by n loop
  for a in select * from aclexplode(array[item.v]) loop
   if a.grantee=(select proowner from pg_proc where oid=target) then continue;end if;
   role_sql:=case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end;
   execute format('grant execute on function %s to %s%s',target,role_sql,case when a.is_grantable then ' with grant option' else '' end);
  end loop;
 end loop;
end $$;
revoke all on function kva_scheduling_private.restore_execute_acl(regprocedure,text) from public,anon,authenticated,service_role;
do $$declare f jsonb;a record;target regprocedure;begin
 for f in select value from jsonb_array_elements((select legacy_proc from kva_scheduling_private.cutover_backup)) loop
  target:=(f->>'oid')::oid::regprocedure;
  for a in select distinct x.grantee from pg_proc p cross join lateral aclexplode(p.proacl) x where p.oid=target and x.grantee<>p.proowner loop
   execute format('revoke all on function %s from %s',target,case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
  end loop;
  execute format('alter function %s set schema kva_scheduling_private',target);
  execute format('alter function %s rename to %I',target,'legacy_'||(f->>'name'));
 end loop;
end $$;
grant select on public.scheduled_flights,public.aircraft_allocations to authenticated;
create policy schedule_read on public.scheduled_flights for select to authenticated using((public.scheduling_mode_enabled() and status='published') or public.is_staff());
create policy allocation_read on public.aircraft_allocations for select to authenticated using(exists(select 1 from public.scheduled_flights s where s.id=scheduled_flight_id));
create function public.scheduling_require_staff() returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock_shared(hashtextextended('kva.scheduling.cutover.v1',0));
 if auth.uid() is null or not public.is_staff() then raise exception 'Active staff required' using errcode='42501'; end if;
end $$;
create function public.set_fleet_scheduling_rule(p_fleet uuid,p_preparation integer,p_turnaround integer)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.scheduling_require_staff();
 insert into public.fleet_scheduling_rules values(p_fleet,p_preparation,p_turnaround)
 on conflict(fleet_type_id) do update set preparation_minutes=excluded.preparation_minutes,turnaround_minutes=excluded.turnaround_minutes;
end $$;

-- Serialization applies to both inserts and changes/releases, including trusted SQL.
create function public.guard_aircraft_allocation() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.scheduled_flights%rowtype; a public.aircraft%rowtype;
begin
 perform pg_advisory_xact_lock_shared(hashtextextended('kva.scheduling.cutover.v1',0));
 if tg_op='UPDATE' then
   perform 1 from public.aircraft where id in (old.aircraft_id,new.aircraft_id) order by id for update;
 else
   perform 1 from public.aircraft where id=new.aircraft_id for update;
 end if;
 if new.allocation_kind='maintenance' then
   if isempty(new.occupied_during) or lower_inf(new.occupied_during) or upper_inf(new.occupied_during)
     or not isfinite(lower(new.occupied_during)) or not isfinite(upper(new.occupied_during)) then
     raise exception 'Finite maintenance interval required';
   end if;
   new.occupied_during:=tstzrange(lower(new.occupied_during),upper(new.occupied_during),'[)');
   return new;
 end if;
 select * into strict s from public.scheduled_flights where id=new.scheduled_flight_id;
 new.occupied_during:=tstzrange(s.departure_at-make_interval(mins=>s.preparation_minutes),s.arrival_at+make_interval(mins=>s.turnaround_minutes),'[)');
 if new.released_at is null then
   select * into strict a from public.aircraft where id=new.aircraft_id;
   if s.status<>'published' or a.status::text<>'active' or a.fleet_type_id<>s.fleet_type_id or a.current_airport_id is null then
     raise exception 'Aircraft unavailable, incompatible or location unknown';
   end if;
   if exists(select 1 from public.flight_bookings b where b.aircraft_id=a.id and b.scheduled_flight_id is null
     and b.status in ('booked','boarding','departed','enroute','landed')) then raise exception 'Unresolved legacy aircraft booking'; end if;
   if exists(select 1 from public.aircraft_operational_state st where st.aircraft_id=a.id
     and st.operational_status<>'available') then raise exception 'Aircraft is not currently available'; end if;
 end if;
 return new;
end $$;
create trigger guard_aircraft_allocation before insert or update on public.aircraft_allocations
for each row execute function public.guard_aircraft_allocation();

create function public.block_aircraft(p_aircraft uuid,p_from timestamptz,p_until timestamptz,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform public.scheduling_require_staff();
 perform 1 from public.aircraft where id=p_aircraft for update;
 insert into public.aircraft_allocations(aircraft_id,allocation_kind,reason,occupied_during)
 values(p_aircraft,'maintenance',p_reason,tstzrange(p_from,p_until,'[)')) returning id into result;
 return result;
end $$;
create function public.release_aircraft_block(p_block uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.scheduling_require_staff();
 update public.aircraft_allocations set released_at=clock_timestamp()
 where id=p_block and allocation_kind='maintenance' and released_at is null;
 if not found then raise exception 'Maintenance block unavailable'; end if;
end $$;

create function public.check_aircraft_rotation() returns trigger language plpgsql security definer set search_path='' as $$
declare tail uuid; expected_airport uuid; leg record;
begin
 for tail in select distinct x from unnest(case when tg_op='INSERT' then array[new.aircraft_id]
   when tg_op='DELETE' then array[old.aircraft_id] else array[old.aircraft_id,new.aircraft_id] end) x order by x loop
   select current_airport_id into expected_airport from public.aircraft where id=tail for update;
   for leg in select s.departure_airport_id,s.arrival_airport_id from public.aircraft_allocations al
     join public.scheduled_flights s on s.id=al.scheduled_flight_id
     where al.aircraft_id=tail and al.released_at is null order by lower(al.occupied_during),s.id loop
     if expected_airport is null or leg.departure_airport_id<>expected_airport then
       raise exception 'Aircraft rotation airport mismatch';
     end if;
     expected_airport:=leg.arrival_airport_id;
   end loop;
 end loop;
 return null;
end $$;
create constraint trigger check_aircraft_rotation after insert or update or delete on public.aircraft_allocations
for each row execute function public.check_aircraft_rotation();

create function public.create_scheduled_flight(p_route uuid,p_aircraft uuid,p_departure timestamptz,p_arrival timestamptz,p_timezone text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.routes%rowtype; rules public.fleet_scheduling_rules%rowtype; result uuid;
begin
 perform public.scheduling_require_staff();
 perform 1 from public.aircraft where id=p_aircraft for update;
 select * into strict r from public.routes where id=p_route and active;
 select * into strict rules from public.fleet_scheduling_rules where fleet_type_id=r.fleet_type_id;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Unknown display timezone'; end if;
 if p_departure-make_interval(mins=>rules.preparation_minutes)<=clock_timestamp() then raise exception 'Preparation must be in the future'; end if;
 insert into public.scheduled_flights(route_id,flight_number,fleet_type_id,departure_airport_id,arrival_airport_id,departure_at,arrival_at,display_timezone,preparation_minutes,turnaround_minutes)
 values(r.id,r.flight_number,r.fleet_type_id,r.departure_airport_id,r.arrival_airport_id,p_departure,p_arrival,p_timezone,rules.preparation_minutes,rules.turnaround_minutes) returning id into result;
 insert into public.aircraft_allocations(scheduled_flight_id,aircraft_id,occupied_during) values(result,p_aircraft,'empty');
 return result;
end $$;

create function public.reschedule_flight(p_schedule uuid,p_aircraft uuid,p_departure timestamptz,p_arrival timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare s public.scheduled_flights%rowtype; previous_aircraft uuid;
begin
 perform public.scheduling_require_staff();
 select * into strict s from public.scheduled_flights where id=p_schedule for update;
 if s.status<>'published' then raise exception 'Schedule unavailable'; end if;
 select aircraft_id into strict previous_aircraft from public.aircraft_allocations where scheduled_flight_id=p_schedule and released_at is null;
 perform 1 from public.aircraft where id in(previous_aircraft,p_aircraft) order by id for update;
 if exists(select 1 from public.flight_bookings where scheduled_flight_id=p_schedule and status in ('booked','boarding','departed','enroute','landed')) then raise exception 'Cancel active bookings before rescheduling'; end if;
 if p_departure-make_interval(mins=>s.preparation_minutes)<=clock_timestamp() then raise exception 'Preparation must be in the future'; end if;
 update public.scheduled_flights set departure_at=p_departure,arrival_at=p_arrival where id=p_schedule;
 update public.aircraft_allocations set aircraft_id=p_aircraft where scheduled_flight_id=p_schedule and released_at is null;
end $$;
create function public.cancel_scheduled_flight(p_schedule uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.scheduling_require_staff();
 perform 1 from public.scheduled_flights where id=p_schedule and status='published' for update;
 if not found then raise exception 'Schedule unavailable'; end if;
 if exists(select 1 from public.flight_bookings where scheduled_flight_id=p_schedule and status in ('booked','boarding','departed','enroute','landed')) then raise exception 'Cancel active bookings first'; end if;
 update public.aircraft_allocations set released_at=clock_timestamp() where scheduled_flight_id=p_schedule and released_at is null;
 update public.scheduled_flights set status='cancelled' where id=p_schedule;
end $$;

create function public.guard_scheduled_booking() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock_shared(hashtextextended('kva.scheduling.cutover.v1',0));
 if not public.scheduling_mode_enabled() then
  if tg_op='DELETE' then
   if old.scheduled_flight_id is not null then raise exception 'Scheduled writes disabled';end if;return old;
  end if;
  if new.scheduled_flight_id is not null or (tg_op='UPDATE' and old.scheduled_flight_id is not null) then raise exception 'Scheduled writes disabled';end if;
  return new;
 end if;
 if tg_op='UPDATE' and new.scheduled_flight_id is null and new.status in ('booked','boarding','departed','enroute','landed') then raise exception 'Legacy active booking blocked after cutover';end if;
 if current_user in ('anon','authenticated') then raise exception 'Use scheduling RPC' using errcode='42501'; end if;
 if tg_op='DELETE' then raise exception 'Booking history cannot be deleted'; end if;
 if tg_op='INSERT' then
   if new.scheduled_flight_id is null then raise exception 'Scheduled occurrence required'; end if;
   if not exists(select 1 from public.scheduled_flights s join public.aircraft_allocations al on al.scheduled_flight_id=s.id
     where s.id=new.scheduled_flight_id and s.route_id=new.route_id and al.aircraft_id=new.aircraft_id and al.released_at is null and s.status='published') then
     raise exception 'Booking allocation mismatch'; end if;
 elsif (new.scheduled_flight_id,new.route_id,new.aircraft_id,new.pilot_id) is distinct from (old.scheduled_flight_id,old.route_id,old.aircraft_id,old.pilot_id) then
   raise exception 'Booking identity is immutable';
 end if;
 return new;
end $$;
create trigger guard_scheduled_booking before insert or update or delete on public.flight_bookings for each row execute function public.guard_scheduled_booking();
create function public.book_scheduled_flight(p_schedule uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); s public.scheduled_flights%rowtype; tail uuid; result uuid;
begin
 perform pg_advisory_xact_lock_shared(hashtextextended('kva.scheduling.cutover.v1',0));
 if not public.scheduling_mode_enabled() then raise exception 'Scheduled booking is not enabled';end if;
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform 1 from public.profiles where id=actor and status='active' for update;
 if not found then raise exception 'Active pilot required' using errcode='42501'; end if;
 select * into strict s from public.scheduled_flights where id=p_schedule for update;
 if s.status<>'published' or s.departure_at<=clock_timestamp() then raise exception 'Schedule unavailable'; end if;
 select aircraft_id into strict tail from public.aircraft_allocations where scheduled_flight_id=s.id and released_at is null;
 perform 1 from public.aircraft where id=tail and status::text='active' for update;
 if not found then raise exception 'Aircraft unavailable'; end if;
 if exists(select 1 from public.flight_bookings where (pilot_id=actor or scheduled_flight_id=s.id) and status in ('booked','boarding','departed','enroute','landed')) then raise exception 'Active booking conflict'; end if;
 -- Re-run current location, legacy booking and operational readiness checks.
 update public.aircraft_allocations set aircraft_id=tail where scheduled_flight_id=s.id and released_at is null;
 insert into public.flight_bookings(route_id,pilot_id,aircraft_id,scheduled_flight_id,status)
 values(s.route_id,actor,tail,s.id,'booked') returning id into result;
 insert into public.dispatches(booking_id,dispatch_number,route,remarks)
 values(result,null,s.flight_number,'Scheduled phase 1: execution is disabled.');
 -- A separate namespace avoids existing projectors changing actual aircraft state
 -- merely because a future flight was booked.
 perform public.append_domain_event(p_event_type=>'schedule.booking_created',p_aggregate_type=>'flight',p_aggregate_id=>result::text,
   p_actor_id=>actor::text,p_correlation_id=>gen_random_uuid(),p_payload=>jsonb_build_object('bookingId',result,'scheduledFlightId',s.id,'aircraftId',tail),
   p_metadata=>jsonb_build_object('privacy','internal','source','schedule.phase1'));
 return result;
end $$;
create function public.cancel_scheduled_booking(p_booking uuid) returns void language plpgsql security definer set search_path='' as $$
declare s_id uuid;
begin
 perform pg_advisory_xact_lock_shared(hashtextextended('kva.scheduling.cutover.v1',0));
 if not public.scheduling_mode_enabled() then raise exception 'Scheduled booking is not enabled';end if;
 select scheduled_flight_id into s_id from public.flight_bookings where id=p_booking and pilot_id=auth.uid();
 if s_id is null then raise exception 'Scheduled booking unavailable'; end if;
 perform 1 from public.scheduled_flights where id=s_id for update;
 update public.flight_bookings set status='cancelled',cancelled_at=clock_timestamp()
 where id=p_booking and pilot_id=auth.uid() and status='booked';
 if not found then raise exception 'Only an unstarted own booking may be cancelled'; end if;
end $$;

create function public.book_route(p_route_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock_shared(hashtextextended('kva.scheduling.cutover.v1',0));
 if public.scheduling_mode_enabled() then raise exception 'Choose a dated scheduled flight';end if;
 return kva_scheduling_private.legacy_book_route(p_route_id);
end $$;
create function public.advance_flight_booking(p_booking_id uuid) returns text language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock_shared(hashtextextended('kva.scheduling.cutover.v1',0));
 if exists(select 1 from public.flight_bookings where id=p_booking_id and scheduled_flight_id is not null) then raise exception 'Scheduled execution disabled in phase 1';end if;
 return kva_scheduling_private.legacy_advance_flight_booking(p_booking_id);
end $$;
create function public.advance_flight_operation(p_booking_id uuid) returns text language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock_shared(hashtextextended('kva.scheduling.cutover.v1',0));
 if exists(select 1 from public.flight_bookings where id=p_booking_id and scheduled_flight_id is not null) then raise exception 'Scheduled execution disabled in phase 1';end if;
 return kva_scheduling_private.legacy_advance_flight_operation(p_booking_id);
end $$;
do $$declare f jsonb;begin
 for f in select value from jsonb_array_elements((select legacy_proc from kva_scheduling_private.cutover_backup)) loop
  perform kva_scheduling_private.restore_execute_acl(format('public.%I(uuid)',f->>'name')::regprocedure,f->>'acl');
 end loop;
end $$;
revoke all on function public.scheduling_require_staff(),public.set_fleet_scheduling_rule(uuid,integer,integer),public.guard_aircraft_allocation(),public.check_aircraft_rotation(),public.create_scheduled_flight(uuid,uuid,timestamptz,timestamptz,text),public.reschedule_flight(uuid,uuid,timestamptz,timestamptz),public.cancel_scheduled_flight(uuid),public.guard_scheduled_booking(),public.book_scheduled_flight(uuid),public.cancel_scheduled_booking(uuid),public.block_aircraft(uuid,timestamptz,timestamptz,text),public.release_aircraft_block(uuid) from public,anon,authenticated,service_role;
grant execute on function public.set_fleet_scheduling_rule(uuid,integer,integer),public.create_scheduled_flight(uuid,uuid,timestamptz,timestamptz,text),public.reschedule_flight(uuid,uuid,timestamptz,timestamptz),public.cancel_scheduled_flight(uuid),public.book_scheduled_flight(uuid),public.cancel_scheduled_booking(uuid),public.block_aircraft(uuid,timestamptz,timestamptz,text),public.release_aircraft_block(uuid) to authenticated;
-- Safe public-to-authenticated projection; no passenger/pilot identifiers exposed.
create function public.list_scheduled_flights() returns table(id uuid,flight_number text,departure text,arrival text,departure_at timestamptz,arrival_at timestamptz,display_timezone text,registration text,booked boolean)
language sql stable security definer set search_path='' as $$
 select s.id,s.flight_number,d.icao_code,a.icao_code,s.departure_at,s.arrival_at,s.display_timezone,ac.registration,
 exists(select 1 from public.flight_bookings b where b.scheduled_flight_id=s.id and b.status in ('booked','boarding','departed','enroute','landed'))
 from public.scheduled_flights s join public.aircraft_allocations al on al.scheduled_flight_id=s.id and al.released_at is null
 join public.aircraft ac on ac.id=al.aircraft_id join public.airports d on d.id=s.departure_airport_id join public.airports a on a.id=s.arrival_airport_id
 where public.scheduling_mode_enabled() and s.status='published' and s.departure_at>now() and auth.uid() is not null
 order by s.departure_at,s.id;
$$;
revoke all on function public.list_scheduled_flights() from public,anon,service_role;
grant execute on function public.list_scheduled_flights() to authenticated;

create function kva_scheduling_private.activate_scheduled_booking() returns void language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('kva.scheduling.cutover.v1',0));
 if not exists(select 1 from kva_scheduling_private.foundation_manifest where phase='prepared' and not scheduling_enabled) then raise exception 'Prepared inactive cutover required';end if;
 if exists(select 1 from public.flight_bookings where scheduled_flight_id is null and status in ('booked','boarding','departed','enroute','landed')) then raise exception 'Active legacy bookings must finish before activation';end if;
 if not exists(select 1 from public.fleet_scheduling_rules) or not exists(select 1 from public.scheduled_flights where status='published') then raise exception 'Reviewed fleet rules and dated flights are required';end if;
 if exists(select 1 from public.scheduled_flights s where status='published' and (departure_at-make_interval(mins=>preparation_minutes)<=clock_timestamp() or not exists(select 1 from public.routes r where r.id=s.route_id and r.active) or not exists(select 1 from public.aircraft_allocations a where a.scheduled_flight_id=s.id and a.released_at is null))) then raise exception 'Schedule is stale, unallocated or unavailable';end if;
 perform 1 from public.aircraft where id in (select aircraft_id from public.aircraft_allocations where released_at is null) order by id for update;
 update public.aircraft_allocations set aircraft_id=aircraft_id where released_at is null;
 update kva_scheduling_private.foundation_manifest set phase='scheduled_booking',scheduling_enabled=true;
end $$;
revoke all on function kva_scheduling_private.activate_scheduled_booking() from public,anon,authenticated,service_role;

do $$begin
 if (select coalesce(jsonb_agg(to_jsonb(b) order by id),'[]'::jsonb) from public.flight_bookings b) is distinct from (select payload->'legacy_baseline'->'bookings' from kva_cutover_baseline) then raise exception 'Booking data changed during preparation';end if;
 if public.scheduling_mode_enabled() then raise exception 'Preparation unexpectedly activated scheduling';end if;
end $$;
select 'PASS: cutover prepared OFF; legacy booking remains operational' as result;
notify pgrst,'reload schema';
commit;
