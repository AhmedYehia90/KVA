-- KVA Flight Events Integration v1.0
-- Durable, atomic domain events for booking, dispatch, flight progress, and PIREP submission.

create extension if not exists pgcrypto;

do $$
begin
  create type public."EventProcessingStatus" as enum (
    'PENDING',
    'PROCESSING',
    'PROCESSED',
    'FAILED',
    'DEAD_LETTER'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_version integer not null default 1 check (event_version > 0),
  organization_id text,
  aggregate_type text not null,
  aggregate_id text not null,
  actor_id text,
  correlation_id uuid not null,
  causation_id uuid,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint platform_events_event_type_format check (
    event_type ~ '^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_-]*$'
  )
);

create table if not exists public.event_processing_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.platform_events(id) on delete cascade,
  consumer_name text not null,
  status public."EventProcessingStatus" not null default 'PENDING',
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, consumer_name)
);

create index if not exists idx_platform_events_type_occurred
on public.platform_events(event_type, occurred_at desc);

create index if not exists idx_platform_events_organization_occurred
on public.platform_events(organization_id, occurred_at desc);

create index if not exists idx_platform_events_aggregate_occurred
on public.platform_events(aggregate_type, aggregate_id, occurred_at desc);

create index if not exists idx_platform_events_correlation
on public.platform_events(correlation_id);

create index if not exists idx_event_processing_status_updated
on public.event_processing_log(status, updated_at);

alter table public.platform_events enable row level security;
alter table public.event_processing_log enable row level security;

-- No client-facing policies are created. Event data remains internal and can be
-- read by trusted server/service-role processes. Domain RPCs append events.

create or replace function public.append_domain_event(
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id text,
  p_payload jsonb default '{}'::jsonb,
  p_actor_id text default null,
  p_organization_id text default 'kalabsha-airlines',
  p_correlation_id uuid default null,
  p_causation_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_event_version integer default 1
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid := gen_random_uuid();
  v_correlation_id uuid := coalesce(p_correlation_id, v_event_id);
begin
  if p_event_type is null
     or p_event_type !~ '^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_-]*$' then
    raise exception 'Invalid event type: %', coalesce(p_event_type, '<null>');
  end if;

  if p_aggregate_type is null or btrim(p_aggregate_type) = '' then
    raise exception 'Aggregate type is required';
  end if;

  if p_aggregate_id is null or btrim(p_aggregate_id) = '' then
    raise exception 'Aggregate id is required';
  end if;

  if p_event_version is null or p_event_version < 1 then
    raise exception 'Event version must be greater than zero';
  end if;

  insert into public.platform_events (
    id,
    event_type,
    event_version,
    organization_id,
    aggregate_type,
    aggregate_id,
    actor_id,
    correlation_id,
    causation_id,
    payload,
    metadata
  )
  values (
    v_event_id,
    p_event_type,
    p_event_version,
    p_organization_id,
    p_aggregate_type,
    p_aggregate_id,
    p_actor_id,
    v_correlation_id,
    p_causation_id,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb)
  );

  return v_event_id;
end;
$$;

revoke all on function public.append_domain_event(
  text, text, text, jsonb, text, text, uuid, uuid, jsonb, integer
) from public, anon, authenticated;

-- Booking and dispatch are written in the same transaction as their events.
create or replace function public.book_route(p_route_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pilot_id uuid := auth.uid();
  v_route public.routes%rowtype;
  v_booking_id uuid;
  v_aircraft_id uuid;
  v_dispatch_id uuid;
  v_correlation_id uuid := gen_random_uuid();
  v_flight_event_id uuid;
  v_aircraft_event_id uuid;
begin
  if v_pilot_id is null then
    raise exception 'Authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_pilot_id::text));

  select *
  into v_route
  from public.routes
  where id = p_route_id
    and active = true;

  if not found then
    raise exception 'The selected route is unavailable';
  end if;

  if exists (
    select 1
    from public.flight_bookings
    where pilot_id = v_pilot_id
      and status in ('booked', 'boarding', 'departed', 'enroute', 'landed')
  ) then
    raise exception 'You already have an active flight booking';
  end if;

  select aircraft.id
  into v_aircraft_id
  from public.aircraft
  where aircraft.fleet_type_id = v_route.fleet_type_id
    and aircraft.status = 'active'
    and not exists (
      select 1
      from public.flight_bookings booking
      where booking.aircraft_id = aircraft.id
        and booking.status in ('booked', 'boarding', 'departed', 'enroute', 'landed')
    )
  order by aircraft.registration
  limit 1
  for update skip locked;

  insert into public.flight_bookings (
    route_id,
    pilot_id,
    aircraft_id,
    status
  )
  values (
    v_route.id,
    v_pilot_id,
    v_aircraft_id,
    'booked'
  )
  returning id into v_booking_id;

  insert into public.dispatches (
    booking_id,
    dispatch_number,
    route,
    remarks
  )
  values (
    v_booking_id,
    null,
    v_route.flight_number,
    case
      when v_aircraft_id is null then 'Aircraft assignment pending.'
      else 'Dispatch generated automatically.'
    end
  )
  returning id into v_dispatch_id;

  v_flight_event_id := public.append_domain_event(
    p_event_type => 'flight.booked',
    p_aggregate_type => 'flight',
    p_aggregate_id => v_booking_id::text,
    p_actor_id => v_pilot_id::text,
    p_correlation_id => v_correlation_id,
    p_payload => jsonb_build_object(
      'bookingId', v_booking_id,
      'routeId', v_route.id,
      'flightNumber', v_route.flight_number,
      'pilotId', v_pilot_id,
      'aircraftId', v_aircraft_id,
      'status', 'booked'
    ),
    p_metadata => jsonb_build_object(
      'source', 'supabase.rpc.book_route',
      'privacy', 'internal'
    )
  );

  if v_aircraft_id is not null then
    v_aircraft_event_id := public.append_domain_event(
      p_event_type => 'aircraft.assigned',
      p_aggregate_type => 'aircraft',
      p_aggregate_id => v_aircraft_id::text,
      p_actor_id => v_pilot_id::text,
      p_correlation_id => v_correlation_id,
      p_causation_id => v_flight_event_id,
      p_payload => jsonb_build_object(
        'aircraftId', v_aircraft_id,
        'bookingId', v_booking_id,
        'routeId', v_route.id,
        'flightNumber', v_route.flight_number,
        'pilotId', v_pilot_id
      ),
      p_metadata => jsonb_build_object(
        'source', 'supabase.rpc.book_route',
        'privacy', 'internal'
      )
    );
  end if;

  perform public.append_domain_event(
    p_event_type => 'dispatch.created',
    p_aggregate_type => 'dispatch',
    p_aggregate_id => v_dispatch_id::text,
    p_actor_id => v_pilot_id::text,
    p_correlation_id => v_correlation_id,
    p_causation_id => coalesce(v_aircraft_event_id, v_flight_event_id),
    p_payload => jsonb_build_object(
      'dispatchId', v_dispatch_id,
      'bookingId', v_booking_id,
      'routeId', v_route.id,
      'flightNumber', v_route.flight_number,
      'pilotId', v_pilot_id,
      'aircraftId', v_aircraft_id
    ),
    p_metadata => jsonb_build_object(
      'source', 'supabase.rpc.book_route',
      'privacy', 'internal'
    )
  );

  return v_booking_id;
end;
$$;

revoke all on function public.book_route(uuid) from public;
grant execute on function public.book_route(uuid) to authenticated;

-- All flight status transitions now occur through one transactional RPC.
create or replace function public.advance_flight_booking(p_booking_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.flight_bookings%rowtype;
  v_route public.routes%rowtype;
  v_next_status text;
  v_event_type text;
  v_now timestamptz := now();
  v_correlation_id uuid := gen_random_uuid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_booking
  from public.flight_bookings
  where id = p_booking_id
    and pilot_id = v_user_id
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;

  select *
  into v_route
  from public.routes
  where id = v_booking.route_id;

  if not found then
    raise exception 'Route not found';
  end if;

  select
    case v_booking.status
      when 'booked' then 'boarding'
      when 'boarding' then 'departed'
      when 'departed' then 'enroute'
      when 'enroute' then 'landed'
      when 'landed' then 'completed'
      else null
    end,
    case v_booking.status
      when 'booked' then 'flight.boarding_started'
      when 'boarding' then 'flight.pushback_started'
      when 'departed' then 'flight.takeoff_recorded'
      when 'enroute' then 'flight.landing_recorded'
      when 'landed' then 'flight.completed'
      else null
    end
  into v_next_status, v_event_type;

  if v_next_status is null or v_event_type is null then
    raise exception 'Flight cannot advance from status %', v_booking.status;
  end if;

  update public.flight_bookings
  set
    status = v_next_status,
    started_at = case
      when v_booking.status = 'booked' then coalesce(started_at, v_now)
      else started_at
    end,
    completed_at = case
      when v_next_status = 'completed' then v_now
      else completed_at
    end,
    updated_at = v_now
  where id = v_booking.id;

  perform public.append_domain_event(
    p_event_type => v_event_type,
    p_aggregate_type => 'flight',
    p_aggregate_id => v_booking.id::text,
    p_actor_id => v_user_id::text,
    p_correlation_id => v_correlation_id,
    p_payload => jsonb_build_object(
      'bookingId', v_booking.id,
      'routeId', v_route.id,
      'flightNumber', v_route.flight_number,
      'pilotId', v_user_id,
      'aircraftId', v_booking.aircraft_id,
      'previousStatus', v_booking.status,
      'status', v_next_status
    ),
    p_metadata => jsonb_build_object(
      'source', 'supabase.rpc.advance_flight_booking',
      'privacy', 'internal'
    )
  );

  return v_next_status;
end;
$$;

revoke all on function public.advance_flight_booking(uuid) from public;
grant execute on function public.advance_flight_booking(uuid) to authenticated;

-- PIREP creation and its event remain atomic.
create or replace function public.submit_booking_pirep(
  p_booking_id uuid,
  p_block_minutes integer,
  p_landing_rate integer default null,
  p_fuel_used_kg numeric default null,
  p_remarks text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.flight_bookings%rowtype;
  v_route public.routes%rowtype;
  v_pirep_id uuid;
  v_correlation_id uuid := gen_random_uuid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_block_minutes is null or p_block_minutes <= 0 then
    raise exception 'Block time must be greater than zero';
  end if;

  select *
  into v_booking
  from public.flight_bookings
  where id = p_booking_id
    and pilot_id = v_user_id
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.status <> 'completed' then
    raise exception 'Flight must be completed before submitting a PIREP';
  end if;

  if exists (
    select 1 from public.pireps where booking_id = p_booking_id
  ) then
    raise exception 'A PIREP already exists for this booking';
  end if;

  select *
  into v_route
  from public.routes
  where id = v_booking.route_id;

  if not found then
    raise exception 'Route not found';
  end if;

  insert into public.pireps (
    pirep_number,
    pirep_code,
    booking_id,
    pilot_id,
    flight_number,
    departure_airport_id,
    arrival_airport_id,
    aircraft_id,
    block_minutes,
    landing_rate,
    fuel_used_kg,
    status,
    remarks
  )
  values (
    nextval('public.pirep_number_seq'),
    '',
    v_booking.id,
    v_user_id,
    v_route.flight_number,
    v_route.departure_airport_id,
    v_route.arrival_airport_id,
    v_booking.aircraft_id,
    p_block_minutes,
    p_landing_rate,
    p_fuel_used_kg,
    'submitted',
    nullif(btrim(p_remarks), '')
  )
  returning id into v_pirep_id;

  update public.profiles
  set
    total_flights = coalesce(total_flights, 0) + 1,
    total_hours = coalesce(total_hours, 0) + (p_block_minutes::numeric / 60.0)
  where id = v_user_id;

  perform public.append_domain_event(
    p_event_type => 'pirep.created',
    p_aggregate_type => 'pirep',
    p_aggregate_id => v_pirep_id::text,
    p_actor_id => v_user_id::text,
    p_correlation_id => v_correlation_id,
    p_payload => jsonb_build_object(
      'pirepId', v_pirep_id,
      'bookingId', v_booking.id,
      'routeId', v_route.id,
      'flightNumber', v_route.flight_number,
      'pilotId', v_user_id,
      'aircraftId', v_booking.aircraft_id,
      'blockMinutes', p_block_minutes,
      'landingRate', p_landing_rate,
      'fuelUsedKg', p_fuel_used_kg,
      'status', 'submitted'
    ),
    p_metadata => jsonb_build_object(
      'source', 'supabase.rpc.submit_booking_pirep',
      'privacy', 'restricted'
    )
  );

  return v_pirep_id;
end;
$$;

revoke all on function public.submit_booking_pirep(uuid, integer, integer, numeric, text) from public;
grant execute on function public.submit_booking_pirep(uuid, integer, integer, numeric, text) to authenticated;
