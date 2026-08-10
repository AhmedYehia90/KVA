-- KVA Global Aviation Events hotfix v1.0.1
-- Archived events must appear in Event History, not Upcoming/Live.

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
          when event.lifecycle_status = 'archived' then 'completed'
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
      when v_event.lifecycle_status = 'archived' then 'completed'
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
