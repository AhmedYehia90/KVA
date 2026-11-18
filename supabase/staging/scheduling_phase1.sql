-- STAGING ONLY. Never apply to production or include in automatic migrations.
begin;
do $$ begin
  if current_setting('kva.scheduling_test_environment', true) is distinct from 'isolated' then
    raise exception 'Isolated scheduling test environment required';
  end if;
end $$;
create extension if not exists btree_gist;

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
grant select on public.scheduled_flights,public.aircraft_allocations to authenticated;
create policy schedule_read on public.scheduled_flights for select to authenticated using(status='published' or public.is_staff());
create policy allocation_read on public.aircraft_allocations for select to authenticated using(exists(select 1 from public.scheduled_flights s where s.id=scheduled_flight_id));

create function public.scheduling_require_staff() returns void language plpgsql security definer set search_path='' as $$
begin
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

-- All client writes must go through reviewed RPCs, including old booking paths.
create function public.guard_scheduled_booking() returns trigger language plpgsql set search_path='' as $$
begin
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
create or replace function public.book_route(p_route_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
begin raise exception 'Choose a dated scheduled flight'; end $$;

create function public.book_scheduled_flight(p_schedule uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); s public.scheduled_flights%rowtype; tail uuid; result uuid;
begin
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
 select scheduled_flight_id into s_id from public.flight_bookings where id=p_booking and pilot_id=auth.uid();
 if s_id is null then raise exception 'Scheduled booking unavailable'; end if;
 perform 1 from public.scheduled_flights where id=s_id for update;
 update public.flight_bookings set status='cancelled',cancelled_at=clock_timestamp()
 where id=p_booking and pilot_id=auth.uid() and status='booked';
 if not found then raise exception 'Only an unstarted own booking may be cancelled'; end if;
end $$;

-- Phase 1 intentionally cannot execute flights; preserve legacy functions for
-- existing records while preventing scheduled operations from entering old engines.
alter function public.advance_flight_booking(uuid) rename to phase1_legacy_advance_booking;
alter function public.advance_flight_operation(uuid) rename to phase1_legacy_advance_operation;
revoke all on function public.phase1_legacy_advance_booking(uuid),public.phase1_legacy_advance_operation(uuid) from public,anon,authenticated,service_role;
create function public.advance_flight_booking(p_booking_id uuid) returns text language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.flight_bookings where id=p_booking_id and scheduled_flight_id is not null) then raise exception 'Scheduled execution disabled in phase 1'; end if;
 return public.phase1_legacy_advance_booking(p_booking_id);
end $$;
create function public.advance_flight_operation(p_booking_id uuid) returns text language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.flight_bookings where id=p_booking_id and scheduled_flight_id is not null) then raise exception 'Scheduled execution disabled in phase 1'; end if;
 return public.phase1_legacy_advance_operation(p_booking_id);
end $$;

-- Default PUBLIC function execution is never accepted for new SECURITY DEFINER RPCs.
revoke all on function public.scheduling_require_staff(),public.set_fleet_scheduling_rule(uuid,integer,integer),public.guard_aircraft_allocation(),public.check_aircraft_rotation(),public.create_scheduled_flight(uuid,uuid,timestamptz,timestamptz,text),public.reschedule_flight(uuid,uuid,timestamptz,timestamptz),public.cancel_scheduled_flight(uuid),public.guard_scheduled_booking(),public.book_scheduled_flight(uuid),public.cancel_scheduled_booking(uuid),public.advance_flight_booking(uuid),public.advance_flight_operation(uuid),public.book_route(uuid) from public,anon,authenticated,service_role;
grant execute on function public.set_fleet_scheduling_rule(uuid,integer,integer),public.create_scheduled_flight(uuid,uuid,timestamptz,timestamptz,text),public.reschedule_flight(uuid,uuid,timestamptz,timestamptz),public.cancel_scheduled_flight(uuid),public.book_scheduled_flight(uuid),public.cancel_scheduled_booking(uuid),public.advance_flight_booking(uuid),public.advance_flight_operation(uuid) to authenticated;
revoke all on function public.block_aircraft(uuid,timestamptz,timestamptz,text),public.release_aircraft_block(uuid) from public,anon,authenticated,service_role;
grant execute on function public.block_aircraft(uuid,timestamptz,timestamptz,text),public.release_aircraft_block(uuid) to authenticated;
-- Safe public-to-authenticated projection; no passenger/pilot identifiers exposed.
create function public.list_scheduled_flights() returns table(id uuid,flight_number text,departure text,arrival text,departure_at timestamptz,arrival_at timestamptz,display_timezone text,registration text,booked boolean)
language sql stable security definer set search_path='' as $$
 select s.id,s.flight_number,d.icao_code,a.icao_code,s.departure_at,s.arrival_at,s.display_timezone,ac.registration,
 exists(select 1 from public.flight_bookings b where b.scheduled_flight_id=s.id and b.status in ('booked','boarding','departed','enroute','landed'))
 from public.scheduled_flights s join public.aircraft_allocations al on al.scheduled_flight_id=s.id and al.released_at is null
 join public.aircraft ac on ac.id=al.aircraft_id join public.airports d on d.id=s.departure_airport_id join public.airports a on a.id=s.arrival_airport_id
 where s.status='published' and s.departure_at>now() and auth.uid() is not null
 order by s.departure_at,s.id;
$$;
revoke all on function public.list_scheduled_flights() from public,anon,service_role;
grant execute on function public.list_scheduled_flights() to authenticated;
commit;
