-- KVA Global Aviation Events Pack v1.0
-- Shared event participation, routes, progress, achievements and history.

create table if not exists public.global_aviation_events (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  slug text not null unique,
  title text not null,
  description text not null,
  category text not null default 'global_campaign',
  lifecycle_status text not null default 'published' check (
    lifecycle_status in ('published', 'archived', 'cancelled')
  ),
  allow_all_organizations boolean not null default true,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  registration_opens_at timestamptz not null,
  registration_closes_at timestamptz not null,
  required_flights integer not null default 1 check (
    required_flights > 0
  ),
  completion_badge_code text not null,
  completion_badge_name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (registration_closes_at >= registration_opens_at),
  check (registration_closes_at <= ends_at)
);

create index if not exists idx_global_events_window
on public.global_aviation_events(lifecycle_status, starts_at, ends_at);

create table if not exists public.global_aviation_event_organizations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null
    references public.global_aviation_events(id) on delete cascade,
  organization_id text not null
    references public.platform_organizations(id) on delete cascade,
  role text not null default 'participant' check (
    role in ('host', 'cohost', 'participant')
  ),
  status text not null default 'active' check (
    status in ('invited', 'active', 'declined', 'removed')
  ),
  joined_at timestamptz not null default now(),
  unique(event_id, organization_id)
);

create index if not exists idx_global_event_orgs_event
on public.global_aviation_event_organizations(event_id, status);

create table if not exists public.global_aviation_event_routes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null
    references public.global_aviation_events(id) on delete cascade,
  route_id uuid not null
    references public.routes(id) on delete restrict,
  sequence_number integer not null default 1 check (sequence_number > 0),
  mission_label text,
  points integer not null default 100 check (points >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(event_id, route_id)
);

create index if not exists idx_global_event_routes_event
on public.global_aviation_event_routes(event_id, active, sequence_number);

create table if not exists public.global_aviation_event_participations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null
    references public.global_aviation_events(id) on delete cascade,
  pilot_id uuid not null
    references public.profiles(id) on delete cascade,
  organization_id text not null
    references public.platform_organizations(id) on delete restrict,
  status text not null default 'joined' check (
    status in ('joined', 'completed', 'withdrawn')
  ),
  completed_flights integer not null default 0 check (
    completed_flights >= 0
  ),
  target_flights integer not null check (target_flights > 0),
  points integer not null default 0 check (points >= 0),
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  withdrawn_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(event_id, pilot_id)
);

create index if not exists idx_global_event_participations_pilot
on public.global_aviation_event_participations(pilot_id, status, joined_at desc);

create index if not exists idx_global_event_participations_event
on public.global_aviation_event_participations(event_id, status);

create table if not exists public.global_aviation_event_flights (
  id uuid primary key default gen_random_uuid(),
  participation_id uuid not null
    references public.global_aviation_event_participations(id) on delete cascade,
  event_id uuid not null
    references public.global_aviation_events(id) on delete cascade,
  event_route_id uuid not null
    references public.global_aviation_event_routes(id) on delete restrict,
  pilot_id uuid not null
    references public.profiles(id) on delete cascade,
  booking_id uuid
    references public.flight_bookings(id) on delete set null,
  source_pirep_id uuid not null
    references public.pireps(id) on delete cascade,
  flight_number text not null,
  points_awarded integer not null default 0 check (points_awarded >= 0),
  credited_at timestamptz not null default now(),
  unique(participation_id, source_pirep_id)
);

create index if not exists idx_global_event_flights_event
on public.global_aviation_event_flights(event_id, credited_at desc);

create index if not exists idx_global_event_flights_pilot
on public.global_aviation_event_flights(pilot_id, credited_at desc);

create table if not exists public.global_aviation_event_achievements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null
    references public.global_aviation_events(id) on delete cascade,
  participation_id uuid not null
    references public.global_aviation_event_participations(id) on delete cascade,
  pilot_id uuid not null
    references public.profiles(id) on delete cascade,
  badge_code text not null,
  badge_name text not null,
  awarded_at timestamptz not null default now(),
  unique(participation_id, badge_code)
);

create index if not exists idx_global_event_achievements_pilot
on public.global_aviation_event_achievements(pilot_id, awarded_at desc);

alter table public.global_aviation_events enable row level security;
alter table public.global_aviation_event_organizations enable row level security;
alter table public.global_aviation_event_routes enable row level security;
alter table public.global_aviation_event_participations enable row level security;
alter table public.global_aviation_event_flights enable row level security;
alter table public.global_aviation_event_achievements enable row level security;

drop policy if exists global_events_read
on public.global_aviation_events;

create policy global_events_read
on public.global_aviation_events
for select
to authenticated
using (lifecycle_status in ('published', 'archived', 'cancelled'));

drop policy if exists global_event_orgs_read
on public.global_aviation_event_organizations;

create policy global_event_orgs_read
on public.global_aviation_event_organizations
for select
to authenticated
using (
  exists (
    select 1
    from public.global_aviation_events event
    where event.id = event_id
      and event.lifecycle_status in ('published', 'archived', 'cancelled')
  )
);

drop policy if exists global_event_routes_read
on public.global_aviation_event_routes;

create policy global_event_routes_read
on public.global_aviation_event_routes
for select
to authenticated
using (
  exists (
    select 1
    from public.global_aviation_events event
    where event.id = event_id
      and event.lifecycle_status in ('published', 'archived', 'cancelled')
  )
);

drop policy if exists global_event_participations_select_own
on public.global_aviation_event_participations;

create policy global_event_participations_select_own
on public.global_aviation_event_participations
for select
to authenticated
using (pilot_id = auth.uid());

drop policy if exists global_event_flights_select_own
on public.global_aviation_event_flights;

create policy global_event_flights_select_own
on public.global_aviation_event_flights
for select
to authenticated
using (pilot_id = auth.uid());

drop policy if exists global_event_achievements_select_own
on public.global_aviation_event_achievements;

create policy global_event_achievements_select_own
on public.global_aviation_event_achievements
for select
to authenticated
using (pilot_id = auth.uid());


create or replace function public.join_global_aviation_event(
  p_event_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event public.global_aviation_events%rowtype;
  v_membership public.pilot_airline_memberships%rowtype;
  v_participation_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_event
  from public.global_aviation_events
  where id = p_event_id;

  if not found then
    raise exception 'Global aviation event not found';
  end if;

  if v_event.lifecycle_status <> 'published' then
    raise exception 'This event is not open for participation';
  end if;

  if now() < v_event.registration_opens_at
     or now() > v_event.registration_closes_at
     or now() > v_event.ends_at then
    raise exception 'Event registration is closed';
  end if;

  if not exists (
    select 1
    from public.global_aviation_event_routes event_route
    where event_route.event_id = v_event.id
      and event_route.active = true
  ) then
    raise exception 'This event has no active missions';
  end if;

  select *
  into v_membership
  from public.pilot_airline_memberships membership
  where membership.pilot_id = v_user_id
    and membership.status = 'active'
  order by membership.is_primary desc, membership.joined_at
  limit 1;

  if not found then
    raise exception 'An active airline membership is required';
  end if;

  if not v_event.allow_all_organizations
     and not exists (
       select 1
       from public.global_aviation_event_organizations organization
       where organization.event_id = v_event.id
         and organization.organization_id = v_membership.organization_id
         and organization.status = 'active'
     ) then
    raise exception 'Your airline is not eligible for this event';
  end if;

  insert into public.global_aviation_event_participations (
    event_id,
    pilot_id,
    organization_id,
    status,
    completed_flights,
    target_flights,
    points,
    joined_at,
    updated_at
  )
  values (
    v_event.id,
    v_user_id,
    v_membership.organization_id,
    'joined',
    0,
    v_event.required_flights,
    0,
    now(),
    now()
  )
  on conflict (event_id, pilot_id)
  do update set
    organization_id = excluded.organization_id,
    status = case
      when public.global_aviation_event_participations.status = 'completed'
        then 'completed'
      else 'joined'
    end,
    withdrawn_at = null,
    updated_at = now()
  returning id into v_participation_id;

  perform public.append_domain_event(
    p_event_type => 'global_event.joined',
    p_aggregate_type => 'global_aviation_event_participation',
    p_aggregate_id => v_participation_id::text,
    p_actor_id => v_user_id::text,
    p_organization_id => v_membership.organization_id,
    p_payload => jsonb_build_object(
      'eventId', v_event.id,
      'eventCode', v_event.code,
      'participationId', v_participation_id,
      'pilotId', v_user_id,
      'organizationId', v_membership.organization_id,
      'targetFlights', v_event.required_flights
    ),
    p_metadata => jsonb_build_object(
      'source', 'global-aviation-events.pilot',
      'privacy', 'pilot_private'
    )
  );

  return v_participation_id;
end;
$$;

revoke all on function public.join_global_aviation_event(uuid)
from public, anon;

grant execute on function public.join_global_aviation_event(uuid)
to authenticated;

create or replace function public.withdraw_global_aviation_event(
  p_event_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_participation public.global_aviation_event_participations%rowtype;
  v_event public.global_aviation_events%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_participation
  from public.global_aviation_event_participations
  where event_id = p_event_id
    and pilot_id = v_user_id
  for update;

  if not found then
    raise exception 'Event participation not found';
  end if;

  if v_participation.status = 'completed' then
    raise exception 'Completed event participation cannot be withdrawn';
  end if;

  select *
  into v_event
  from public.global_aviation_events
  where id = p_event_id;

  update public.global_aviation_event_participations
  set
    status = 'withdrawn',
    withdrawn_at = now(),
    updated_at = now()
  where id = v_participation.id;

  perform public.append_domain_event(
    p_event_type => 'global_event.withdrawn',
    p_aggregate_type => 'global_aviation_event_participation',
    p_aggregate_id => v_participation.id::text,
    p_actor_id => v_user_id::text,
    p_organization_id => v_participation.organization_id,
    p_payload => jsonb_build_object(
      'eventId', p_event_id,
      'eventCode', v_event.code,
      'participationId', v_participation.id,
      'pilotId', v_user_id
    ),
    p_metadata => jsonb_build_object(
      'source', 'global-aviation-events.pilot',
      'privacy', 'pilot_private'
    )
  );

  return true;
end;
$$;

revoke all on function public.withdraw_global_aviation_event(uuid)
from public, anon;

grant execute on function public.withdraw_global_aviation_event(uuid)
to authenticated;

create or replace function public.create_global_aviation_event(
  p_code text,
  p_slug text,
  p_title text,
  p_description text,
  p_category text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_registration_opens_at timestamptz,
  p_registration_closes_at timestamptz,
  p_required_flights integer,
  p_badge_name text,
  p_route_ids uuid[],
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_route_id uuid;
  v_sequence integer := 0;
  v_code text := upper(btrim(p_code));
  v_slug text := lower(btrim(p_slug));
begin
  if v_code = '' or v_slug = '' or btrim(p_title) = '' then
    raise exception 'Event code, slug and title are required';
  end if;

  if p_ends_at <= p_starts_at then
    raise exception 'Event end must be after event start';
  end if;

  if p_registration_closes_at < p_registration_opens_at
     or p_registration_closes_at > p_ends_at then
    raise exception 'Registration window is invalid';
  end if;

  if coalesce(array_length(p_route_ids, 1), 0) = 0 then
    raise exception 'At least one event route is required';
  end if;

  insert into public.global_aviation_events (
    code,
    slug,
    title,
    description,
    category,
    lifecycle_status,
    allow_all_organizations,
    starts_at,
    ends_at,
    registration_opens_at,
    registration_closes_at,
    required_flights,
    completion_badge_code,
    completion_badge_name,
    created_by,
    created_at,
    updated_at
  )
  values (
    v_code,
    v_slug,
    btrim(p_title),
    btrim(p_description),
    coalesce(nullif(btrim(p_category), ''), 'global_campaign'),
    'published',
    true,
    p_starts_at,
    p_ends_at,
    p_registration_opens_at,
    p_registration_closes_at,
    greatest(1, p_required_flights),
    v_code || '-COMPLETED',
    btrim(p_badge_name),
    p_actor_id,
    now(),
    now()
  )
  returning id into v_event_id;

  insert into public.global_aviation_event_organizations (
    event_id,
    organization_id,
    role,
    status
  )
  values (
    v_event_id,
    'kalabsha-airlines',
    'host',
    'active'
  );

  foreach v_route_id in array p_route_ids
  loop
    if exists (
      select 1
      from public.routes route
      where route.id = v_route_id
        and route.active = true
    ) then
      v_sequence := v_sequence + 1;

      insert into public.global_aviation_event_routes (
        event_id,
        route_id,
        sequence_number,
        mission_label,
        points,
        active
      )
      values (
        v_event_id,
        v_route_id,
        v_sequence,
        format('Mission %s', v_sequence),
        100,
        true
      )
      on conflict (event_id, route_id) do nothing;
    end if;
  end loop;

  if v_sequence = 0 then
    raise exception 'No selected routes are currently active';
  end if;

  perform public.append_domain_event(
    p_event_type => 'global_event.published',
    p_aggregate_type => 'global_aviation_event',
    p_aggregate_id => v_event_id::text,
    p_actor_id => p_actor_id::text,
    p_organization_id => 'kalabsha-airlines',
    p_payload => jsonb_build_object(
      'eventId', v_event_id,
      'eventCode', v_code,
      'slug', v_slug,
      'title', btrim(p_title),
      'routeCount', v_sequence,
      'requiredFlights', greatest(1, p_required_flights),
      'startsAt', p_starts_at,
      'endsAt', p_ends_at
    ),
    p_metadata => jsonb_build_object(
      'source', 'global-aviation-events.operations',
      'privacy', 'internal'
    )
  );

  return v_event_id;
end;
$$;

revoke all on function public.create_global_aviation_event(
  text, text, text, text, text,
  timestamptz, timestamptz, timestamptz, timestamptz,
  integer, text, uuid[], uuid
) from public, anon, authenticated;

grant execute on function public.create_global_aviation_event(
  text, text, text, text, text,
  timestamptz, timestamptz, timestamptz, timestamptz,
  integer, text, uuid[], uuid
) to service_role;

create or replace function public.set_global_aviation_event_lifecycle(
  p_event_id uuid,
  p_status text,
  p_actor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.global_aviation_events%rowtype;
  v_event_type text;
begin
  if p_status not in ('published', 'archived', 'cancelled') then
    raise exception 'Invalid event lifecycle status';
  end if;

  select *
  into v_event
  from public.global_aviation_events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Global aviation event not found';
  end if;

  update public.global_aviation_events
  set
    lifecycle_status = p_status,
    updated_at = now()
  where id = p_event_id;

  v_event_type := case p_status
    when 'cancelled' then 'global_event.cancelled'
    when 'archived' then 'global_event.archived'
    else 'global_event.published'
  end;

  perform public.append_domain_event(
    p_event_type => v_event_type,
    p_aggregate_type => 'global_aviation_event',
    p_aggregate_id => p_event_id::text,
    p_actor_id => p_actor_id::text,
    p_organization_id => 'kalabsha-airlines',
    p_payload => jsonb_build_object(
      'eventId', p_event_id,
      'eventCode', v_event.code,
      'title', v_event.title,
      'lifecycleStatus', p_status
    ),
    p_metadata => jsonb_build_object(
      'source', 'global-aviation-events.operations',
      'privacy', 'internal'
    )
  );

  return true;
end;
$$;

revoke all on function public.set_global_aviation_event_lifecycle(
  uuid, text, uuid
) from public, anon, authenticated;

grant execute on function public.set_global_aviation_event_lifecycle(
  uuid, text, uuid
) to service_role;


create or replace function public.credit_global_aviation_event_pirep(
  p_pirep_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pirep public.pireps%rowtype;
  v_booking public.flight_bookings%rowtype;
  v_participation record;
  v_event_route public.global_aviation_event_routes%rowtype;
  v_credit_id uuid;
  v_completed_flights integer;
  v_points integer;
  v_just_completed boolean;
  v_achievement_id uuid;
  v_credited_count integer := 0;
begin
  select *
  into v_pirep
  from public.pireps
  where id = p_pirep_id;

  if not found then
    return 0;
  end if;

  if v_pirep.status::text not in ('submitted', 'approved') then
    return 0;
  end if;

  if v_pirep.booking_id is null then
    return 0;
  end if;

  select *
  into v_booking
  from public.flight_bookings
  where id = v_pirep.booking_id;

  if not found then
    return 0;
  end if;

  for v_participation in
    select
      participation.id,
      participation.event_id,
      participation.pilot_id,
      participation.organization_id,
      participation.status,
      participation.target_flights,
      participation.joined_at,
      event.code as event_code,
      event.title as event_title,
      event.starts_at,
      event.ends_at,
      event.lifecycle_status,
      event.completion_badge_code,
      event.completion_badge_name
    from public.global_aviation_event_participations participation
    join public.global_aviation_events event
      on event.id = participation.event_id
    where participation.pilot_id = v_pirep.pilot_id
      and participation.status = 'joined'
      and event.lifecycle_status in ('published', 'archived')
      and v_pirep.created_at >= participation.joined_at
      and v_pirep.created_at >= event.starts_at
      and v_pirep.created_at <= event.ends_at
    order by participation.joined_at, participation.id
  loop
    select *
    into v_event_route
    from public.global_aviation_event_routes event_route
    where event_route.event_id = v_participation.event_id
      and event_route.route_id = v_booking.route_id
      and event_route.active = true
    limit 1;

    if not found then
      continue;
    end if;

    v_credit_id := null;

    insert into public.global_aviation_event_flights (
      participation_id,
      event_id,
      event_route_id,
      pilot_id,
      booking_id,
      source_pirep_id,
      flight_number,
      points_awarded,
      credited_at
    )
    values (
      v_participation.id,
      v_participation.event_id,
      v_event_route.id,
      v_pirep.pilot_id,
      v_pirep.booking_id,
      v_pirep.id,
      v_pirep.flight_number,
      v_event_route.points,
      now()
    )
    on conflict (participation_id, source_pirep_id)
    do nothing
    returning id into v_credit_id;

    if v_credit_id is null then
      continue;
    end if;

    select
      count(*)::integer,
      coalesce(sum(event_flight.points_awarded), 0)::integer
    into
      v_completed_flights,
      v_points
    from public.global_aviation_event_flights event_flight
    where event_flight.participation_id = v_participation.id;

    v_just_completed :=
      v_completed_flights >= v_participation.target_flights;

    update public.global_aviation_event_participations
    set
      completed_flights = v_completed_flights,
      points = v_points,
      status = case
        when v_just_completed then 'completed'
        else status
      end,
      completed_at = case
        when v_just_completed then coalesce(completed_at, now())
        else completed_at
      end,
      updated_at = now()
    where id = v_participation.id;

    perform public.append_domain_event(
      p_event_type => 'global_event.flight_credited',
      p_aggregate_type => 'global_aviation_event_participation',
      p_aggregate_id => v_participation.id::text,
      p_actor_id => v_pirep.pilot_id::text,
      p_organization_id => v_participation.organization_id,
      p_payload => jsonb_build_object(
        'eventId', v_participation.event_id,
        'eventCode', v_participation.event_code,
        'participationId', v_participation.id,
        'eventFlightId', v_credit_id,
        'pilotId', v_pirep.pilot_id,
        'bookingId', v_pirep.booking_id,
        'pirepId', v_pirep.id,
        'flightNumber', v_pirep.flight_number,
        'completedFlights', v_completed_flights,
        'targetFlights', v_participation.target_flights,
        'points', v_points
      ),
      p_metadata => jsonb_build_object(
        'source', 'global-aviation-events.pirep',
        'privacy', 'pilot_private'
      )
    );

    if v_just_completed then
      v_achievement_id := null;

      insert into public.global_aviation_event_achievements (
        event_id,
        participation_id,
        pilot_id,
        badge_code,
        badge_name,
        awarded_at
      )
      values (
        v_participation.event_id,
        v_participation.id,
        v_pirep.pilot_id,
        v_participation.completion_badge_code,
        v_participation.completion_badge_name,
        now()
      )
      on conflict (participation_id, badge_code)
      do nothing
      returning id into v_achievement_id;

      perform public.append_domain_event(
        p_event_type => 'global_event.completed',
        p_aggregate_type => 'global_aviation_event_participation',
        p_aggregate_id => v_participation.id::text,
        p_actor_id => v_pirep.pilot_id::text,
        p_organization_id => v_participation.organization_id,
        p_payload => jsonb_build_object(
          'eventId', v_participation.event_id,
          'eventCode', v_participation.event_code,
          'eventTitle', v_participation.event_title,
          'participationId', v_participation.id,
          'pilotId', v_pirep.pilot_id,
          'completedFlights', v_completed_flights,
          'targetFlights', v_participation.target_flights,
          'points', v_points
        ),
        p_metadata => jsonb_build_object(
          'source', 'global-aviation-events.progress',
          'privacy', 'pilot_private'
        )
      );

      if v_achievement_id is not null then
        perform public.append_domain_event(
          p_event_type => 'global_event.achievement_awarded',
          p_aggregate_type => 'global_aviation_event_achievement',
          p_aggregate_id => v_achievement_id::text,
          p_actor_id => v_pirep.pilot_id::text,
          p_organization_id => v_participation.organization_id,
          p_payload => jsonb_build_object(
            'eventId', v_participation.event_id,
            'eventCode', v_participation.event_code,
            'participationId', v_participation.id,
            'achievementId', v_achievement_id,
            'pilotId', v_pirep.pilot_id,
            'badgeCode', v_participation.completion_badge_code,
            'badgeName', v_participation.completion_badge_name
          ),
          p_metadata => jsonb_build_object(
            'source', 'global-aviation-events.achievement',
            'privacy', 'pilot_private'
          )
        );
      end if;
    end if;

    v_credited_count := v_credited_count + 1;
  end loop;

  return v_credited_count;
end;
$$;

revoke all on function public.credit_global_aviation_event_pirep(uuid)
from public, anon, authenticated;

grant execute on function public.credit_global_aviation_event_pirep(uuid)
to service_role;

create or replace function public.handle_global_aviation_event_pirep()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status::text in ('submitted', 'approved') then
    begin
      perform public.credit_global_aviation_event_pirep(new.id);
    exception
      when others then
        raise warning
          'Global Aviation Events could not credit PIREP %: %',
          new.id,
          sqlerrm;
    end;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_global_aviation_event_pirep()
from public, anon, authenticated;

drop trigger if exists after_pirep_global_aviation_event_credit
on public.pireps;

create trigger after_pirep_global_aviation_event_credit
after insert or update of status
on public.pireps
for each row
execute function public.handle_global_aviation_event_pirep();


create or replace function public.get_global_aviation_event_hub()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(
    jsonb_agg(event_payload order by sort_starts_at, sort_title),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      event.starts_at as sort_starts_at,
      event.title as sort_title,
      jsonb_build_object(
        'id', event.id,
        'code', event.code,
        'slug', event.slug,
        'title', event.title,
        'description', event.description,
        'category', event.category,
        'lifecycleStatus', event.lifecycle_status,
        'phase', case
          when event.lifecycle_status = 'cancelled' then 'cancelled'
          when now() < event.starts_at then 'upcoming'
          when now() <= event.ends_at
               and event.lifecycle_status = 'published' then 'live'
          else 'completed'
        end,
        'registrationOpen',
          event.lifecycle_status = 'published'
          and now() >= event.registration_opens_at
          and now() <= event.registration_closes_at
          and now() <= event.ends_at,
        'startsAt', event.starts_at,
        'endsAt', event.ends_at,
        'registrationOpensAt', event.registration_opens_at,
        'registrationClosesAt', event.registration_closes_at,
        'requiredFlights', event.required_flights,
        'badgeCode', event.completion_badge_code,
        'badgeName', event.completion_badge_name,
        'routeCount', (
          select count(*)
          from public.global_aviation_event_routes route
          where route.event_id = event.id
            and route.active = true
        ),
        'participants', (
          select count(*)
          from public.global_aviation_event_participations participation
          where participation.event_id = event.id
            and participation.status <> 'withdrawn'
        ),
        'completedParticipants', (
          select count(*)
          from public.global_aviation_event_participations participation
          where participation.event_id = event.id
            and participation.status = 'completed'
        ),
        'creditedFlights', (
          select count(*)
          from public.global_aviation_event_flights event_flight
          where event_flight.event_id = event.id
        ),
        'organizations', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', organization.id,
              'code', organization.code,
              'name', organization.name,
              'role', event_org.role
            )
            order by
              case event_org.role
                when 'host' then 1
                when 'cohost' then 2
                else 3
              end,
              organization.name
          )
          from public.global_aviation_event_organizations event_org
          join public.platform_organizations organization
            on organization.id = event_org.organization_id
          where event_org.event_id = event.id
            and event_org.status = 'active'
        ), '[]'::jsonb),
        'myParticipation', (
          select jsonb_build_object(
            'id', participation.id,
            'status', participation.status,
            'organizationId', participation.organization_id,
            'completedFlights', participation.completed_flights,
            'targetFlights', participation.target_flights,
            'points', participation.points,
            'joinedAt', participation.joined_at,
            'completedAt', participation.completed_at
          )
          from public.global_aviation_event_participations participation
          where participation.event_id = event.id
            and participation.pilot_id = v_user_id
          limit 1
        ),
        'myAchievement', (
          select jsonb_build_object(
            'id', achievement.id,
            'badgeCode', achievement.badge_code,
            'badgeName', achievement.badge_name,
            'awardedAt', achievement.awarded_at
          )
          from public.global_aviation_event_achievements achievement
          where achievement.event_id = event.id
            and achievement.pilot_id = v_user_id
          order by achievement.awarded_at desc
          limit 1
        )
      ) as event_payload
    from public.global_aviation_events event
    where event.lifecycle_status in ('published', 'archived', 'cancelled')
  ) hub;

  return v_result;
end;
$$;

revoke all on function public.get_global_aviation_event_hub()
from public, anon;

grant execute on function public.get_global_aviation_event_hub()
to authenticated;

create or replace function public.get_global_aviation_event_detail(
  p_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_event public.global_aviation_events%rowtype;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_event
  from public.global_aviation_events
  where slug = p_slug
    and lifecycle_status in ('published', 'archived', 'cancelled');

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'id', v_event.id,
    'code', v_event.code,
    'slug', v_event.slug,
    'title', v_event.title,
    'description', v_event.description,
    'category', v_event.category,
    'lifecycleStatus', v_event.lifecycle_status,
    'phase', case
      when v_event.lifecycle_status = 'cancelled' then 'cancelled'
      when now() < v_event.starts_at then 'upcoming'
      when now() <= v_event.ends_at
           and v_event.lifecycle_status = 'published' then 'live'
      else 'completed'
    end,
    'registrationOpen',
      v_event.lifecycle_status = 'published'
      and now() >= v_event.registration_opens_at
      and now() <= v_event.registration_closes_at
      and now() <= v_event.ends_at,
    'startsAt', v_event.starts_at,
    'endsAt', v_event.ends_at,
    'registrationOpensAt', v_event.registration_opens_at,
    'registrationClosesAt', v_event.registration_closes_at,
    'requiredFlights', v_event.required_flights,
    'badgeCode', v_event.completion_badge_code,
    'badgeName', v_event.completion_badge_name,
    'participants', (
      select count(*)
      from public.global_aviation_event_participations participation
      where participation.event_id = v_event.id
        and participation.status <> 'withdrawn'
    ),
    'completedParticipants', (
      select count(*)
      from public.global_aviation_event_participations participation
      where participation.event_id = v_event.id
        and participation.status = 'completed'
    ),
    'creditedFlights', (
      select count(*)
      from public.global_aviation_event_flights event_flight
      where event_flight.event_id = v_event.id
    ),
    'organizations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', organization.id,
          'code', organization.code,
          'name', organization.name,
          'role', event_org.role
        )
        order by organization.name
      )
      from public.global_aviation_event_organizations event_org
      join public.platform_organizations organization
        on organization.id = event_org.organization_id
      where event_org.event_id = v_event.id
        and event_org.status = 'active'
    ), '[]'::jsonb),
    'routes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'eventRouteId', event_route.id,
          'routeId', route.id,
          'sequence', event_route.sequence_number,
          'missionLabel', event_route.mission_label,
          'points', event_route.points,
          'flightNumber', route.flight_number,
          'scheduledMinutes', route.scheduled_minutes,
          'distanceNm', route.distance_nm,
          'departure', departure.icao_code,
          'departureName', departure.name,
          'arrival', arrival.icao_code,
          'arrivalName', arrival.name,
          'aircraftType', fleet.icao_code
        )
        order by event_route.sequence_number, route.flight_number
      )
      from public.global_aviation_event_routes event_route
      join public.routes route
        on route.id = event_route.route_id
      join public.airports departure
        on departure.id = route.departure_airport_id
      join public.airports arrival
        on arrival.id = route.arrival_airport_id
      left join public.fleet_types fleet
        on fleet.id = route.fleet_type_id
      where event_route.event_id = v_event.id
        and event_route.active = true
    ), '[]'::jsonb),
    'myParticipation', (
      select jsonb_build_object(
        'id', participation.id,
        'status', participation.status,
        'organizationId', participation.organization_id,
        'completedFlights', participation.completed_flights,
        'targetFlights', participation.target_flights,
        'points', participation.points,
        'joinedAt', participation.joined_at,
        'completedAt', participation.completed_at,
        'creditedFlights', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', event_flight.id,
              'flightNumber', event_flight.flight_number,
              'points', event_flight.points_awarded,
              'creditedAt', event_flight.credited_at
            )
            order by event_flight.credited_at desc
          )
          from public.global_aviation_event_flights event_flight
          where event_flight.participation_id = participation.id
        ), '[]'::jsonb)
      )
      from public.global_aviation_event_participations participation
      where participation.event_id = v_event.id
        and participation.pilot_id = v_user_id
      limit 1
    ),
    'myAchievements', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', achievement.id,
          'badgeCode', achievement.badge_code,
          'badgeName', achievement.badge_name,
          'awardedAt', achievement.awarded_at
        )
        order by achievement.awarded_at desc
      )
      from public.global_aviation_event_achievements achievement
      where achievement.event_id = v_event.id
        and achievement.pilot_id = v_user_id
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_global_aviation_event_detail(text)
from public, anon;

grant execute on function public.get_global_aviation_event_detail(text)
to authenticated;


-- Seed one live founder event so the pillar can be tested immediately.
do $$
declare
  v_event_id uuid;
  v_route record;
  v_sequence integer := 0;
begin
  insert into public.global_aviation_events (
    code,
    slug,
    title,
    description,
    category,
    lifecycle_status,
    allow_all_organizations,
    starts_at,
    ends_at,
    registration_opens_at,
    registration_closes_at,
    required_flights,
    completion_badge_code,
    completion_badge_name,
    created_at,
    updated_at
  )
  values (
    'KVA-GLOBAL-001',
    'kva-os-global-launch-relay',
    'KVA OS Global Launch Relay',
    'A founder event celebrating the shared KVA OS aviation network. Join the event, fly one eligible mission and complete your first Global Aviation Events record.',
    'global_campaign',
    'published',
    true,
    now() - interval '1 hour',
    now() + interval '14 days',
    now() - interval '1 day',
    now() + interval '13 days',
    1,
    'KVA-GLOBAL-001-COMPLETED',
    'KVA OS Global Launch Finisher',
    now(),
    now()
  )
  on conflict (code)
  do update set
    title = excluded.title,
    description = excluded.description,
    lifecycle_status = 'published',
    updated_at = now()
  returning id into v_event_id;

  insert into public.global_aviation_event_organizations (
    event_id,
    organization_id,
    role,
    status
  )
  values (
    v_event_id,
    'kalabsha-airlines',
    'host',
    'active'
  )
  on conflict (event_id, organization_id)
  do update set
    role = 'host',
    status = 'active';

  for v_route in
    select route.id, route.flight_number
    from public.routes route
    where route.active = true
    order by route.flight_number
    limit 4
  loop
    v_sequence := v_sequence + 1;

    insert into public.global_aviation_event_routes (
      event_id,
      route_id,
      sequence_number,
      mission_label,
      points,
      active
    )
    values (
      v_event_id,
      v_route.id,
      v_sequence,
      format('Launch Mission %s', v_sequence),
      100,
      true
    )
    on conflict (event_id, route_id)
    do update set
      sequence_number = excluded.sequence_number,
      mission_label = excluded.mission_label,
      active = true;
  end loop;

  if v_sequence = 0 then
    raise exception
      'Global Aviation Events seed requires at least one active route';
  end if;
end
$$;
