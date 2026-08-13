-- KVA OS — Pillar 10 Living Airports v1.0 COMPLETE
--
-- World-awareness layer built from existing KVA OS evidence.
--
-- Core integrity:
--   * KVA OS airport pulse is a PLATFORM ACTIVITY metric, not real-world traffic.
--   * Airport notices are KVA OS platform/airline notices, not NOTAM, ATC or weather.
--   * Existing flight, event, fleet, route, economy and PIREP systems remain authoritative.
--   * No airport page mutates operational state.

create table if not exists public.airport_world_notices (
  id uuid primary key default gen_random_uuid(),
  airport_id uuid not null
    references public.airports(id) on delete cascade,
  publisher_organization_id text not null
    references public.platform_organizations(id) on delete restrict,
  category text not null default 'advisory' check (
    category in ('operations', 'event', 'community', 'network', 'advisory')
  ),
  severity text not null default 'info' check (
    severity in ('info', 'watch', 'important')
  ),
  title text not null,
  message text not null,
  lifecycle_status text not null default 'draft' check (
    lifecycle_status in ('draft', 'published', 'closed')
  ),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  source_label text,
  source_reference text,
  created_by uuid references public.profiles(id) on delete set null,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists idx_airport_world_notices_airport_window
on public.airport_world_notices(
  airport_id,
  lifecycle_status,
  starts_at,
  ends_at
);

create index if not exists idx_airport_world_notices_org
on public.airport_world_notices(
  publisher_organization_id,
  created_at desc
);

create table if not exists public.airport_world_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null
    references public.profiles(id) on delete restrict,
  organization_id text not null
    references public.platform_organizations(id) on delete restrict,
  airport_id uuid
    references public.airports(id) on delete set null,
  notice_id uuid
    references public.airport_world_notices(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_airport_world_admin_audit_org
on public.airport_world_admin_audit(
  organization_id,
  created_at desc
);

alter table public.airport_world_notices enable row level security;
alter table public.airport_world_admin_audit enable row level security;

-- No broad client policies are created.
-- Pilot/world access is through controlled read-only projections.
-- Operations administration uses the existing service-role server pattern.


create or replace function public.living_airport_pulse_score(
  p_live_movements integer,
  p_completed_24h integer,
  p_parked_aircraft integer,
  p_active_routes integer,
  p_active_events integer,
  p_active_notices integer,
  p_route_interest_signals integer
)
returns integer
language sql
immutable
as $$
  select least(
    100,
    greatest(
      0,
      coalesce(p_live_movements, 0) * 25
      + coalesce(p_completed_24h, 0) * 7
      + coalesce(p_parked_aircraft, 0) * 2
      + coalesce(p_active_routes, 0)
      + coalesce(p_active_events, 0) * 10
      + coalesce(p_active_notices, 0) * 8
      + coalesce(p_route_interest_signals, 0) * 4
    )
  )::integer;
$$;

create or replace function public.living_airport_pulse_label(
  p_score integer
)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_score, 0) >= 70 then 'HIGH ACTIVITY'
    when coalesce(p_score, 0) >= 40 then 'BUSY'
    when coalesce(p_score, 0) >= 10 then 'ACTIVE'
    else 'QUIET'
  end;
$$;


create or replace function public.get_living_airports_world()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_airports jsonb := '[]'::jsonb;
  v_total_airports integer := 0;
  v_live_movements integer := 0;
  v_active_notices integer := 0;
  v_active_events integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  with airport_metrics as (
    select
      airport.id,
      airport.icao_code,
      airport.iata_code,
      airport.name,
      airport.city,
      airport.country,
      airport.latitude,
      airport.longitude,
      airport.timezone,

      (
        select count(*)::integer
        from public.routes route
        where route.active
          and (
            route.departure_airport_id = airport.id
            or route.arrival_airport_id = airport.id
          )
      ) as active_routes,

      (
        select count(*)::integer
        from public.aircraft aircraft
        where aircraft.current_airport_id = airport.id
          and aircraft.status::text <> 'retired'
      ) as parked_aircraft,

      (
        select count(*)::integer
        from public.operations_flight_projection projection
        join public.routes route
          on route.id = projection.route_id
        where projection.status in ('boarding', 'departed', 'enroute', 'landed')
          and (
            route.departure_airport_id = airport.id
            or route.arrival_airport_id = airport.id
          )
      ) as live_movements,

      (
        select count(*)::integer
        from public.flight_bookings booking
        join public.routes route
          on route.id = booking.route_id
        where booking.status = 'completed'
          and booking.completed_at >= now() - interval '24 hours'
          and (
            route.departure_airport_id = airport.id
            or route.arrival_airport_id = airport.id
          )
      ) as completed_24h,

      (
        select count(*)::integer
        from public.global_aviation_event_routes event_route
        join public.global_aviation_events event
          on event.id = event_route.event_id
        join public.routes route
          on route.id = event_route.route_id
        where event_route.active
          and event.lifecycle_status = 'published'
          and event.ends_at >= now()
          and (
            route.departure_airport_id = airport.id
            or route.arrival_airport_id = airport.id
          )
      ) as active_events,

      (
        select count(*)::integer
        from public.airport_world_notices notice
        where notice.airport_id = airport.id
          and notice.lifecycle_status = 'published'
          and notice.starts_at <= now()
          and (
            notice.ends_at is null
            or notice.ends_at >= now()
          )
      ) as active_notices,

      (
        select count(*)::integer
        from public.route_support_campaigns campaign
        where campaign.status in (
          'active',
          'goal_reached',
          'under_review',
          'approved'
        )
          and (
            campaign.departure_airport_id = airport.id
            or campaign.arrival_airport_id = airport.id
          )
      ) as route_interest_signals

    from public.airports airport
    where airport.active
  ),
  decorated as (
    select
      metrics.*,
      public.living_airport_pulse_score(
        metrics.live_movements,
        metrics.completed_24h,
        metrics.parked_aircraft,
        metrics.active_routes,
        metrics.active_events,
        metrics.active_notices,
        metrics.route_interest_signals
      ) as pulse_score
    from airport_metrics metrics
  )
  select
    count(*)::integer,
    coalesce(sum(live_movements), 0)::integer,
    coalesce(sum(active_notices), 0)::integer,
    coalesce(sum(active_events), 0)::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'icaoCode', icao_code,
          'iataCode', iata_code,
          'name', name,
          'city', city,
          'country', country,
          'latitude', latitude,
          'longitude', longitude,
          'timezone', timezone,
          'activeRoutes', active_routes,
          'parkedAircraft', parked_aircraft,
          'liveMovements', live_movements,
          'completed24h', completed_24h,
          'activeEvents', active_events,
          'activeNotices', active_notices,
          'routeInterestSignals', route_interest_signals,
          'pulseScore', pulse_score,
          'pulseLabel',
            public.living_airport_pulse_label(pulse_score)
        )
        order by pulse_score desc, icao_code
      ),
      '[]'::jsonb
    )
  into
    v_total_airports,
    v_live_movements,
    v_active_notices,
    v_active_events,
    v_airports
  from decorated;

  return jsonb_build_object(
    'schemaVersion', 1,
    'projection', 'living-airports.world',
    'authority', 'read-only-kva-os-world-awareness',
    'generatedAt', now(),
    'disclaimer',
      'KVA OS activity only. Not real-world ATC, NOTAM, weather, closure or traffic authority.',
    'summary', jsonb_build_object(
      'airports', v_total_airports,
      'liveMovements', v_live_movements,
      'activeNotices', v_active_notices,
      'activeGlobalEventLinks', v_active_events
    ),
    'airports', coalesce(v_airports, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_living_airports_world()
from public, anon;

grant execute on function public.get_living_airports_world()
to authenticated;


create or replace function public.get_living_airport_detail(
  p_icao_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_icao text := upper(btrim(coalesce(p_icao_code, '')));
  v_airport public.airports%rowtype;
  v_active_routes integer := 0;
  v_parked_aircraft integer := 0;
  v_live_movements integer := 0;
  v_completed_24h integer := 0;
  v_active_events integer := 0;
  v_active_notices integer := 0;
  v_route_signals integer := 0;
  v_pulse integer := 0;
  v_live_board jsonb := '[]'::jsonb;
  v_ground_fleet jsonb := '[]'::jsonb;
  v_network jsonb := '[]'::jsonb;
  v_events jsonb := '[]'::jsonb;
  v_notices jsonb := '[]'::jsonb;
  v_route_support jsonb := '[]'::jsonb;
  v_recent jsonb := '[]'::jsonb;
  v_pilot_history jsonb := '{}'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_airport
  from public.airports airport
  where airport.active
    and airport.icao_code = v_icao
  limit 1;

  if not found then
    return null;
  end if;

  select count(*)::integer
  into v_active_routes
  from public.routes route
  where route.active
    and (
      route.departure_airport_id = v_airport.id
      or route.arrival_airport_id = v_airport.id
    );

  select count(*)::integer
  into v_parked_aircraft
  from public.aircraft aircraft
  where aircraft.current_airport_id = v_airport.id
    and aircraft.status::text <> 'retired';

  select count(*)::integer
  into v_live_movements
  from public.operations_flight_projection projection
  join public.routes route on route.id = projection.route_id
  where projection.status in ('boarding', 'departed', 'enroute', 'landed')
    and (
      route.departure_airport_id = v_airport.id
      or route.arrival_airport_id = v_airport.id
    );

  select count(*)::integer
  into v_completed_24h
  from public.flight_bookings booking
  join public.routes route on route.id = booking.route_id
  where booking.status = 'completed'
    and booking.completed_at >= now() - interval '24 hours'
    and (
      route.departure_airport_id = v_airport.id
      or route.arrival_airport_id = v_airport.id
    );

  select count(*)::integer
  into v_active_events
  from public.global_aviation_event_routes event_route
  join public.global_aviation_events event
    on event.id = event_route.event_id
  join public.routes route
    on route.id = event_route.route_id
  where event_route.active
    and event.lifecycle_status = 'published'
    and event.ends_at >= now()
    and (
      route.departure_airport_id = v_airport.id
      or route.arrival_airport_id = v_airport.id
    );

  select count(*)::integer
  into v_active_notices
  from public.airport_world_notices notice
  where notice.airport_id = v_airport.id
    and notice.lifecycle_status = 'published'
    and notice.starts_at <= now()
    and (
      notice.ends_at is null
      or notice.ends_at >= now()
    );

  select count(*)::integer
  into v_route_signals
  from public.route_support_campaigns campaign
  where campaign.status in (
    'active',
    'goal_reached',
    'under_review',
    'approved'
  )
    and (
      campaign.departure_airport_id = v_airport.id
      or campaign.arrival_airport_id = v_airport.id
    );

  v_pulse := public.living_airport_pulse_score(
    v_live_movements,
    v_completed_24h,
    v_parked_aircraft,
    v_active_routes,
    v_active_events,
    v_active_notices,
    v_route_signals
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bookingId', projection.booking_id,
        'flightNumber', route.flight_number,
        'status', projection.status,
        'direction',
          case
            when route.departure_airport_id = v_airport.id
              then 'departure'
            else 'arrival'
          end,
        'otherAirport',
          case
            when route.departure_airport_id = v_airport.id
              then arrival.icao_code
            else departure.icao_code
          end,
        'otherAirportName',
          case
            when route.departure_airport_id = v_airport.id
              then arrival.name
            else departure.name
          end,
        'aircraftRegistration', aircraft.registration,
        'fleetIcao', fleet.icao_code,
        'pilotCallsign', pilot.callsign,
        'lastEventAt', projection.last_event_at
      )
      order by projection.last_event_at desc, route.flight_number
    ),
    '[]'::jsonb
  )
  into v_live_board
  from public.operations_flight_projection projection
  join public.routes route
    on route.id = projection.route_id
  join public.airports departure
    on departure.id = route.departure_airport_id
  join public.airports arrival
    on arrival.id = route.arrival_airport_id
  left join public.aircraft aircraft
    on aircraft.id = projection.aircraft_id
  left join public.fleet_types fleet
    on fleet.id = aircraft.fleet_type_id
  left join public.profiles pilot
    on pilot.id = projection.pilot_id
  where projection.status in ('boarding', 'departed', 'enroute', 'landed')
    and (
      route.departure_airport_id = v_airport.id
      or route.arrival_airport_id = v_airport.id
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'aircraftId', aircraft.id,
        'registration', aircraft.registration,
        'status', aircraft.status,
        'fleetIcao', fleet.icao_code,
        'manufacturer', fleet.manufacturer,
        'model', fleet.model
      )
      order by fleet.icao_code, aircraft.registration
    ),
    '[]'::jsonb
  )
  into v_ground_fleet
  from public.aircraft aircraft
  left join public.fleet_types fleet
    on fleet.id = aircraft.fleet_type_id
  where aircraft.current_airport_id = v_airport.id
    and aircraft.status::text <> 'retired';

  with destination_rows as (
    select
      case
        when route.departure_airport_id = v_airport.id
          then arrival.id
        else departure.id
      end as destination_id,
      case
        when route.departure_airport_id = v_airport.id
          then arrival.icao_code
        else departure.icao_code
      end as icao_code,
      case
        when route.departure_airport_id = v_airport.id
          then arrival.name
        else departure.name
      end as name,
      case
        when route.departure_airport_id = v_airport.id
          then arrival.city
        else departure.city
      end as city,
      route.id as route_id,
      fleet.icao_code as fleet_icao
    from public.routes route
    join public.airports departure
      on departure.id = route.departure_airport_id
    join public.airports arrival
      on arrival.id = route.arrival_airport_id
    left join public.fleet_types fleet
      on fleet.id = route.fleet_type_id
    where route.active
      and (
        route.departure_airport_id = v_airport.id
        or route.arrival_airport_id = v_airport.id
      )
  ),
  grouped as (
    select
      destination_id,
      icao_code,
      name,
      city,
      count(*)::integer as route_count,
      array_agg(distinct fleet_icao order by fleet_icao)
        filter (where fleet_icao is not null) as fleet_types
    from destination_rows
    group by destination_id, icao_code, name, city
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'airportId', destination_id,
        'icaoCode', icao_code,
        'name', name,
        'city', city,
        'routeCount', route_count,
        'fleetTypes', coalesce(to_jsonb(fleet_types), '[]'::jsonb)
      )
      order by route_count desc, icao_code
    ),
    '[]'::jsonb
  )
  into v_network
  from grouped;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'eventId', event.id,
        'eventCode', event.code,
        'slug', event.slug,
        'title', event.title,
        'category', event.category,
        'startsAt', event.starts_at,
        'endsAt', event.ends_at,
        'missionLabel', event_route.mission_label,
        'points', event_route.points,
        'flightNumber', route.flight_number,
        'route',
          departure.icao_code || ' → ' || arrival.icao_code
      )
      order by event.starts_at, event.title, event_route.sequence_number
    ),
    '[]'::jsonb
  )
  into v_events
  from public.global_aviation_event_routes event_route
  join public.global_aviation_events event
    on event.id = event_route.event_id
  join public.routes route
    on route.id = event_route.route_id
  join public.airports departure
    on departure.id = route.departure_airport_id
  join public.airports arrival
    on arrival.id = route.arrival_airport_id
  where event_route.active
    and event.lifecycle_status = 'published'
    and event.ends_at >= now()
    and (
      route.departure_airport_id = v_airport.id
      or route.arrival_airport_id = v_airport.id
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'noticeId', notice.id,
        'publisherOrganizationId', notice.publisher_organization_id,
        'category', notice.category,
        'severity', notice.severity,
        'title', notice.title,
        'message', notice.message,
        'startsAt', notice.starts_at,
        'endsAt', notice.ends_at,
        'state',
          case
            when notice.starts_at > now() then 'upcoming'
            else 'active'
          end,
        'sourceLabel', notice.source_label,
        'sourceReference', notice.source_reference
      )
      order by notice.starts_at, notice.created_at
    ),
    '[]'::jsonb
  )
  into v_notices
  from public.airport_world_notices notice
  where notice.airport_id = v_airport.id
    and notice.lifecycle_status = 'published'
    and notice.starts_at <= now() + interval '30 days'
    and (
      notice.ends_at is null
      or notice.ends_at >= now()
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'campaignId', campaign.id,
        'code', campaign.code,
        'title', campaign.title,
        'status', campaign.status,
        'fundedAmount', campaign.funded_amount,
        'targetAmount', campaign.target_amount,
        'route',
          departure.icao_code || ' → ' || arrival.icao_code,
        'operationsNote', campaign.operations_note
      )
      order by campaign.created_at desc
    ),
    '[]'::jsonb
  )
  into v_route_support
  from public.route_support_campaigns campaign
  join public.airports departure
    on departure.id = campaign.departure_airport_id
  join public.airports arrival
    on arrival.id = campaign.arrival_airport_id
  where campaign.status in (
    'active',
    'goal_reached',
    'under_review',
    'approved'
  )
    and (
      campaign.departure_airport_id = v_airport.id
      or campaign.arrival_airport_id = v_airport.id
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bookingId', recent.booking_id,
        'flightNumber', recent.flight_number,
        'completedAt', recent.completed_at,
        'route', recent.route_label,
        'direction', recent.direction
      )
      order by recent.completed_at desc
    ),
    '[]'::jsonb
  )
  into v_recent
  from (
    select
      booking.id as booking_id,
      route.flight_number,
      booking.completed_at,
      departure.icao_code || ' → ' || arrival.icao_code as route_label,
      case
        when route.departure_airport_id = v_airport.id
          then 'departure'
        else 'arrival'
      end as direction
    from public.flight_bookings booking
    join public.routes route
      on route.id = booking.route_id
    join public.airports departure
      on departure.id = route.departure_airport_id
    join public.airports arrival
      on arrival.id = route.arrival_airport_id
    where booking.status = 'completed'
      and booking.completed_at is not null
      and (
        route.departure_airport_id = v_airport.id
        or route.arrival_airport_id = v_airport.id
      )
    order by booking.completed_at desc
    limit 12
  ) recent;

  select jsonb_build_object(
    'completedVisits', count(*)::integer,
    'departures',
      count(*) filter (
        where route.departure_airport_id = v_airport.id
      )::integer,
    'arrivals',
      count(*) filter (
        where route.arrival_airport_id = v_airport.id
      )::integer,
    'firstVisitAt', min(booking.completed_at),
    'latestVisitAt', max(booking.completed_at)
  )
  into v_pilot_history
  from public.flight_bookings booking
  join public.routes route
    on route.id = booking.route_id
  where booking.pilot_id = v_user_id
    and booking.status = 'completed'
    and booking.completed_at is not null
    and (
      route.departure_airport_id = v_airport.id
      or route.arrival_airport_id = v_airport.id
    );

  return jsonb_build_object(
    'schemaVersion', 1,
    'projection', 'living-airports.detail',
    'authority', 'read-only-kva-os-world-awareness',
    'generatedAt', now(),
    'disclaimer',
      'KVA OS activity only. Not real-world ATC, NOTAM, weather, closure or traffic authority.',
    'airport', jsonb_build_object(
      'id', v_airport.id,
      'icaoCode', v_airport.icao_code,
      'iataCode', v_airport.iata_code,
      'name', v_airport.name,
      'city', v_airport.city,
      'country', v_airport.country,
      'latitude', v_airport.latitude,
      'longitude', v_airport.longitude,
      'timezone', v_airport.timezone
    ),
    'pulse', jsonb_build_object(
      'score', v_pulse,
      'label', public.living_airport_pulse_label(v_pulse),
      'activeRoutes', v_active_routes,
      'parkedAircraft', v_parked_aircraft,
      'liveMovements', v_live_movements,
      'completed24h', v_completed_24h,
      'activeEvents', v_active_events,
      'activeNotices', v_active_notices,
      'routeInterestSignals', v_route_signals
    ),
    'pilotHistory', coalesce(v_pilot_history, '{}'::jsonb),
    'liveBoard', coalesce(v_live_board, '[]'::jsonb),
    'groundFleet', coalesce(v_ground_fleet, '[]'::jsonb),
    'network', coalesce(v_network, '[]'::jsonb),
    'globalEvents', coalesce(v_events, '[]'::jsonb),
    'notices', coalesce(v_notices, '[]'::jsonb),
    'routeSupport', coalesce(v_route_support, '[]'::jsonb),
    'recentActivity', coalesce(v_recent, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_living_airport_detail(text)
from public, anon;

grant execute on function public.get_living_airport_detail(text)
to authenticated;


create or replace function public.create_airport_world_notice(
  p_airport_id uuid,
  p_organization_id text,
  p_category text,
  p_severity text,
  p_title text,
  p_message text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_source_label text,
  p_source_reference text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_category text := lower(btrim(coalesce(p_category, 'advisory')));
  v_severity text := lower(btrim(coalesce(p_severity, 'info')));
begin
  if p_actor_id is null then
    raise exception 'Administrative actor is required';
  end if;

  if p_airport_id is null then
    raise exception 'Airport is required';
  end if;

  if btrim(coalesce(p_organization_id, '')) = '' then
    raise exception 'Organization is required';
  end if;

  if v_category not in (
    'operations',
    'event',
    'community',
    'network',
    'advisory'
  ) then
    raise exception 'Invalid airport notice category';
  end if;

  if v_severity not in ('info', 'watch', 'important') then
    raise exception 'Invalid airport notice severity';
  end if;

  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'Notice title is required';
  end if;

  if btrim(coalesce(p_message, '')) = '' then
    raise exception 'Notice message is required';
  end if;

  if p_ends_at is not null
     and p_ends_at <= coalesce(p_starts_at, now()) then
    raise exception 'Notice end must be after start';
  end if;

  insert into public.airport_world_notices (
    airport_id,
    publisher_organization_id,
    category,
    severity,
    title,
    message,
    lifecycle_status,
    starts_at,
    ends_at,
    source_label,
    source_reference,
    created_by,
    created_at,
    updated_at
  )
  values (
    p_airport_id,
    p_organization_id,
    v_category,
    v_severity,
    btrim(p_title),
    btrim(p_message),
    'draft',
    coalesce(p_starts_at, now()),
    p_ends_at,
    nullif(btrim(coalesce(p_source_label, '')), ''),
    nullif(btrim(coalesce(p_source_reference, '')), ''),
    p_actor_id,
    now(),
    now()
  )
  returning id into v_id;

  insert into public.airport_world_admin_audit (
    actor_id,
    organization_id,
    airport_id,
    notice_id,
    action,
    details
  )
  values (
    p_actor_id,
    p_organization_id,
    p_airport_id,
    v_id,
    'airport_notice_created',
    jsonb_build_object(
      'title', btrim(p_title),
      'category', v_category,
      'severity', v_severity,
      'lifecycleStatus', 'draft'
    )
  );

  perform public.append_domain_event(
    p_event_type => 'airport.notice_created',
    p_aggregate_type => 'airport_world_notice',
    p_aggregate_id => v_id::text,
    p_actor_id => p_actor_id::text,
    p_organization_id => p_organization_id,
    p_payload => jsonb_build_object(
      'noticeId', v_id,
      'airportId', p_airport_id,
      'title', btrim(p_title),
      'category', v_category,
      'severity', v_severity,
      'lifecycleStatus', 'draft'
    ),
    p_metadata => jsonb_build_object(
      'source', 'living-airports.operations'
    )
  );

  return v_id;
end;
$$;

revoke all on function public.create_airport_world_notice(
  uuid, text, text, text, text, text,
  timestamptz, timestamptz, text, text, uuid
) from public, anon, authenticated;

grant execute on function public.create_airport_world_notice(
  uuid, text, text, text, text, text,
  timestamptz, timestamptz, text, text, uuid
) to service_role;


create or replace function public.update_airport_world_notice(
  p_notice_id uuid,
  p_category text,
  p_severity text,
  p_title text,
  p_message text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_source_label text,
  p_source_reference text,
  p_actor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notice public.airport_world_notices%rowtype;
  v_category text := lower(btrim(coalesce(p_category, 'advisory')));
  v_severity text := lower(btrim(coalesce(p_severity, 'info')));
begin
  if p_actor_id is null then
    raise exception 'Administrative actor is required';
  end if;

  if p_notice_id is null then
    raise exception 'Notice is required';
  end if;

  if v_category not in (
    'operations',
    'event',
    'community',
    'network',
    'advisory'
  ) then
    raise exception 'Invalid airport notice category';
  end if;

  if v_severity not in ('info', 'watch', 'important') then
    raise exception 'Invalid airport notice severity';
  end if;

  if btrim(coalesce(p_title, '')) = ''
     or btrim(coalesce(p_message, '')) = '' then
    raise exception 'Notice title and message are required';
  end if;

  if p_ends_at is not null
     and p_ends_at <= coalesce(p_starts_at, now()) then
    raise exception 'Notice end must be after start';
  end if;

  select *
  into v_notice
  from public.airport_world_notices
  where id = p_notice_id
  for update;

  if not found then
    raise exception 'Airport notice not found';
  end if;

  update public.airport_world_notices
  set
    category = v_category,
    severity = v_severity,
    title = btrim(p_title),
    message = btrim(p_message),
    starts_at = coalesce(p_starts_at, starts_at),
    ends_at = p_ends_at,
    source_label = nullif(btrim(coalesce(p_source_label, '')), ''),
    source_reference = nullif(btrim(coalesce(p_source_reference, '')), ''),
    updated_at = now()
  where id = p_notice_id;

  insert into public.airport_world_admin_audit (
    actor_id,
    organization_id,
    airport_id,
    notice_id,
    action,
    details
  )
  values (
    p_actor_id,
    v_notice.publisher_organization_id,
    v_notice.airport_id,
    p_notice_id,
    'airport_notice_updated',
    jsonb_build_object(
      'title', btrim(p_title),
      'category', v_category,
      'severity', v_severity,
      'lifecycleStatus', v_notice.lifecycle_status
    )
  );

  perform public.append_domain_event(
    p_event_type => 'airport.notice_updated',
    p_aggregate_type => 'airport_world_notice',
    p_aggregate_id => p_notice_id::text,
    p_actor_id => p_actor_id::text,
    p_organization_id => v_notice.publisher_organization_id,
    p_payload => jsonb_build_object(
      'noticeId', p_notice_id,
      'airportId', v_notice.airport_id,
      'title', btrim(p_title),
      'category', v_category,
      'severity', v_severity,
      'lifecycleStatus', v_notice.lifecycle_status
    ),
    p_metadata => jsonb_build_object(
      'source', 'living-airports.operations'
    )
  );

  return true;
end;
$$;

revoke all on function public.update_airport_world_notice(
  uuid, text, text, text, text,
  timestamptz, timestamptz, text, text, uuid
) from public, anon, authenticated;

grant execute on function public.update_airport_world_notice(
  uuid, text, text, text, text,
  timestamptz, timestamptz, text, text, uuid
) to service_role;


create or replace function public.set_airport_world_notice_lifecycle(
  p_notice_id uuid,
  p_status text,
  p_actor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notice public.airport_world_notices%rowtype;
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_event_type text;
begin
  if p_actor_id is null then
    raise exception 'Administrative actor is required';
  end if;

  if v_status not in ('draft', 'published', 'closed') then
    raise exception 'Invalid airport notice lifecycle status';
  end if;

  select *
  into v_notice
  from public.airport_world_notices
  where id = p_notice_id
  for update;

  if not found then
    raise exception 'Airport notice not found';
  end if;

  update public.airport_world_notices
  set
    lifecycle_status = v_status,
    published_by = case
      when v_status = 'published' then p_actor_id
      else published_by
    end,
    published_at = case
      when v_status = 'published' then coalesce(published_at, now())
      else published_at
    end,
    closed_by = case
      when v_status = 'closed' then p_actor_id
      else null
    end,
    closed_at = case
      when v_status = 'closed' then now()
      else null
    end,
    updated_at = now()
  where id = p_notice_id;

  insert into public.airport_world_admin_audit (
    actor_id,
    organization_id,
    airport_id,
    notice_id,
    action,
    details
  )
  values (
    p_actor_id,
    v_notice.publisher_organization_id,
    v_notice.airport_id,
    p_notice_id,
    'airport_notice_' || v_status,
    jsonb_build_object(
      'title', v_notice.title,
      'fromStatus', v_notice.lifecycle_status,
      'toStatus', v_status
    )
  );

  v_event_type := case v_status
    when 'published' then 'airport.notice_published'
    when 'closed' then 'airport.notice_closed'
    else 'airport.notice_drafted'
  end;

  perform public.append_domain_event(
    p_event_type => v_event_type,
    p_aggregate_type => 'airport_world_notice',
    p_aggregate_id => p_notice_id::text,
    p_actor_id => p_actor_id::text,
    p_organization_id => v_notice.publisher_organization_id,
    p_payload => jsonb_build_object(
      'noticeId', p_notice_id,
      'airportId', v_notice.airport_id,
      'title', v_notice.title,
      'fromStatus', v_notice.lifecycle_status,
      'toStatus', v_status
    ),
    p_metadata => jsonb_build_object(
      'source', 'living-airports.operations'
    )
  );

  return true;
end;
$$;

revoke all on function public.set_airport_world_notice_lifecycle(
  uuid, text, uuid
) from public, anon, authenticated;

grant execute on function public.set_airport_world_notice_lifecycle(
  uuid, text, uuid
) to service_role;


comment on table public.airport_world_notices
is 'Pillar 10 KVA OS airport-world notices. These are platform/airline context, not real-world NOTAM/weather/ATC authority.';

comment on function public.get_living_airports_world()
is 'Pillar 10 read-only world projection of KVA OS airport activity.';

comment on function public.get_living_airport_detail(text)
is 'Pillar 10 read-only airport detail projection combining KVA OS flights, fleet, events, route interest and curated airport notices.';
