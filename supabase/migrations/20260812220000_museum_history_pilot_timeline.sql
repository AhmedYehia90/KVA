-- KVA OS Pillar 09 — Museum / History RC1
-- Read-only pilot legacy projection.
--
-- Architectural rule:
-- Existing operational, passport, career, qualification and global-event data
-- remain authoritative. This migration creates no parallel history table and
-- performs no mutation of flight, career, economy, route or fleet state.

create or replace function public.get_pilot_museum_history()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_passport jsonb := '{}'::jsonb;
  v_career jsonb := '{}'::jsonb;
  v_first_flight jsonb := '{}'::jsonb;
  v_favorite_aircraft jsonb := '{}'::jsonb;
  v_latest_promotion jsonb := '{}'::jsonb;
  v_first_event_achievement jsonb := '{}'::jsonb;
  v_timeline jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select jsonb_build_object(
    'passportNumber', passport.passport_number,
    'issuedAt', passport.issued_at,
    'status', passport.status,
    'visibility', passport.visibility,
    'journeyYears',
      greatest(
        0,
        extract(year from age(now(), passport.issued_at))::integer
      )
  )
  into v_passport
  from public.pilot_passports passport
  where passport.pilot_id = v_user_id
  order by passport.issued_at
  limit 1;

  select jsonb_build_object(
    'organizationId', account.organization_id,
    'careerXp', account.career_xp,
    'completedFlights', account.completed_flights,
    'flightMinutes', account.flight_minutes,
    'flightHours', round(account.flight_minutes::numeric / 60.0, 1),
    'currentRankCode', account.current_rank_code
  )
  into v_career
  from public.pilot_career_accounts account
  where account.pilot_id = v_user_id;

  select jsonb_build_object(
    'bookingId', booking.id,
    'occurredAt', coalesce(booking.completed_at, booking.updated_at),
    'flightNumber', route.flight_number,
    'departureIcao', departure.icao_code,
    'arrivalIcao', arrival.icao_code,
    'aircraftRegistration', aircraft.registration,
    'fleetIcao', fleet.icao_code,
    'manufacturer', fleet.manufacturer,
    'model', fleet.model
  )
  into v_first_flight
  from public.flight_bookings booking
  join public.routes route
    on route.id = booking.route_id
  left join public.airports departure
    on departure.id = route.departure_airport_id
  left join public.airports arrival
    on arrival.id = route.arrival_airport_id
  left join public.aircraft aircraft
    on aircraft.id = booking.aircraft_id
  left join public.fleet_types fleet
    on fleet.id = aircraft.fleet_type_id
  where booking.pilot_id = v_user_id
    and booking.status = 'completed'
  order by coalesce(booking.completed_at, booking.updated_at), booking.id
  limit 1;

  select jsonb_build_object(
    'fleetIcao', ranked.icao_code,
    'manufacturer', ranked.manufacturer,
    'model', ranked.model,
    'completedFlights', ranked.completed_flights
  )
  into v_favorite_aircraft
  from (
    select
      fleet.icao_code,
      fleet.manufacturer,
      fleet.model,
      count(*)::integer as completed_flights
    from public.flight_bookings booking
    join public.aircraft aircraft
      on aircraft.id = booking.aircraft_id
    join public.fleet_types fleet
      on fleet.id = aircraft.fleet_type_id
    where booking.pilot_id = v_user_id
      and booking.status = 'completed'
    group by fleet.id, fleet.icao_code, fleet.manufacturer, fleet.model
    order by count(*) desc, fleet.icao_code
    limit 1
  ) ranked;

  select jsonb_build_object(
    'promotionId', promotion.id,
    'fromRankCode', promotion.from_rank_code,
    'toRankCode', promotion.to_rank_code,
    'careerXp', promotion.career_xp,
    'completedFlights', promotion.completed_flights,
    'flightMinutes', promotion.flight_minutes,
    'promotedAt', promotion.promoted_at,
    'sourcePirepId', promotion.source_pirep_id
  )
  into v_latest_promotion
  from public.career_promotion_history promotion
  where promotion.pilot_id = v_user_id
  order by promotion.promoted_at desc, promotion.id desc
  limit 1;

  select jsonb_build_object(
    'achievementId', achievement.id,
    'eventId', achievement.event_id,
    'eventTitle', event.title,
    'eventCode', event.code,
    'badgeCode', achievement.badge_code,
    'badgeName', achievement.badge_name,
    'awardedAt', achievement.awarded_at
  )
  into v_first_event_achievement
  from public.global_aviation_event_achievements achievement
  join public.global_aviation_events event
    on event.id = achievement.event_id
  where achievement.pilot_id = v_user_id
  order by achievement.awarded_at, achievement.id
  limit 1;

  with timeline_rows as (
    select
      'passport:' || passport.id::text as item_id,
      'passport'::text as item_kind,
      passport.issued_at as occurred_at,
      'Universal Pilot Passport issued'::text as title,
      ('Passport ' || passport.passport_number || ' became part of your KVA OS identity.')::text
        as description,
      jsonb_build_object(
        'passportId', passport.id,
        'passportNumber', passport.passport_number,
        'source', 'pilot_passports'
      ) as evidence,
      10 as sort_order
    from public.pilot_passports passport
    where passport.pilot_id = v_user_id

    union all

    select
      'milestone:' || achieved.id::text,
      'career_milestone',
      achieved.achieved_at,
      definition.title,
      definition.description,
      jsonb_build_object(
        'milestoneId', definition.id,
        'milestoneCode', definition.code,
        'metric', definition.metric,
        'threshold', definition.threshold,
        'sourcePirepId', achieved.source_pirep_id,
        'source', 'pilot_career_milestones'
      ),
      20
    from public.pilot_career_milestones achieved
    join public.career_milestone_definitions definition
      on definition.id = achieved.milestone_id
    where achieved.pilot_id = v_user_id

    union all

    select
      'promotion:' || promotion.id::text,
      'career_promotion',
      promotion.promoted_at,
      ('Promoted to ' || promotion.to_rank_code)::text,
      (
        case
          when promotion.from_rank_code is null then
            'Your KVA OS career rank was established as ' || promotion.to_rank_code || '.'
          else
            'Career progression from ' || promotion.from_rank_code ||
            ' to ' || promotion.to_rank_code || '.'
        end
      )::text,
      jsonb_build_object(
        'promotionId', promotion.id,
        'fromRankCode', promotion.from_rank_code,
        'toRankCode', promotion.to_rank_code,
        'careerXp', promotion.career_xp,
        'completedFlights', promotion.completed_flights,
        'flightMinutes', promotion.flight_minutes,
        'sourcePirepId', promotion.source_pirep_id,
        'source', 'career_promotion_history'
      ),
      30
    from public.career_promotion_history promotion
    where promotion.pilot_id = v_user_id

    union all

    select
      'qualification:' || rating.id::text,
      'qualification',
      rating.issued_at,
      (fleet.icao_code || ' qualification issued')::text,
      (fleet.manufacturer || ' ' || fleet.model || ' was added to your aircraft qualifications.')::text,
      jsonb_build_object(
        'ratingId', rating.id,
        'fleetTypeId', fleet.id,
        'fleetIcao', fleet.icao_code,
        'expiresAt', rating.expires_at,
        'active', rating.is_active,
        'source', 'pilot_type_ratings'
      ),
      40
    from public.pilot_type_ratings rating
    join public.fleet_types fleet
      on fleet.id = rating.fleet_type_id
    where rating.pilot_id = v_user_id

    union all

    select
      'event-achievement:' || achievement.id::text,
      'event_achievement',
      achievement.awarded_at,
      achievement.badge_name,
      ('Historic achievement from ' || event.title || '.')::text,
      jsonb_build_object(
        'achievementId', achievement.id,
        'eventId', event.id,
        'eventCode', event.code,
        'eventTitle', event.title,
        'badgeCode', achievement.badge_code,
        'source', 'global_aviation_event_achievements'
      ),
      50
    from public.global_aviation_event_achievements achievement
    join public.global_aviation_events event
      on event.id = achievement.event_id
    where achievement.pilot_id = v_user_id

    union all

    select
      flight_row.item_id,
      flight_row.item_kind,
      flight_row.occurred_at,
      flight_row.title,
      flight_row.description,
      flight_row.evidence,
      flight_row.sort_order
    from (
      select
        'flight:' || booking.id::text as item_id,
        'flight'::text as item_kind,
        coalesce(booking.completed_at, booking.updated_at) as occurred_at,
        (route.flight_number || ' completed')::text as title,
        (
          coalesce(departure.icao_code, '----') || ' → ' ||
          coalesce(arrival.icao_code, '----') ||
          case
            when fleet.icao_code is not null
              then ' · ' || fleet.icao_code
            else ''
          end
        )::text as description,
        jsonb_build_object(
          'bookingId', booking.id,
          'routeId', route.id,
          'flightNumber', route.flight_number,
          'departureIcao', departure.icao_code,
          'arrivalIcao', arrival.icao_code,
          'aircraftId', aircraft.id,
          'aircraftRegistration', aircraft.registration,
          'fleetTypeId', fleet.id,
          'fleetIcao', fleet.icao_code,
          'source', 'flight_bookings'
        ) as evidence,
        60 as sort_order
      from public.flight_bookings booking
      join public.routes route
        on route.id = booking.route_id
      left join public.airports departure
        on departure.id = route.departure_airport_id
      left join public.airports arrival
        on arrival.id = route.arrival_airport_id
      left join public.aircraft aircraft
        on aircraft.id = booking.aircraft_id
      left join public.fleet_types fleet
        on fleet.id = aircraft.fleet_type_id
      where booking.pilot_id = v_user_id
        and booking.status = 'completed'
      order by coalesce(booking.completed_at, booking.updated_at) desc, booking.id desc
      limit 40
    ) flight_row
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item_id,
        'kind', item_kind,
        'occurredAt', occurred_at,
        'title', title,
        'description', description,
        'evidence', evidence
      )
      order by occurred_at desc, sort_order, item_id
    ),
    '[]'::jsonb
  )
  into v_timeline
  from timeline_rows;

  select jsonb_build_object(
    'journeySince', (v_passport -> 'issuedAt'),
    'passportNumber', (v_passport -> 'passportNumber'),
    'journeyYears', coalesce((v_passport ->> 'journeyYears')::integer, 0),
    'careerXp', coalesce((v_career ->> 'careerXp')::bigint, 0),
    'completedFlights', coalesce((v_career ->> 'completedFlights')::integer, 0),
    'flightMinutes', coalesce((v_career ->> 'flightMinutes')::bigint, 0),
    'flightHours', coalesce((v_career ->> 'flightHours')::numeric, 0),
    'currentRankCode', coalesce(v_career ->> 'currentRankCode', 'CADET'),
    'milestones', (
      select count(*)::integer
      from public.pilot_career_milestones milestone
      where milestone.pilot_id = v_user_id
    ),
    'promotions', (
      select count(*)::integer
      from public.career_promotion_history promotion
      where promotion.pilot_id = v_user_id
    ),
    'eventAchievements', (
      select count(*)::integer
      from public.global_aviation_event_achievements achievement
      where achievement.pilot_id = v_user_id
    ),
    'aircraftTypesFlown', (
      select count(distinct aircraft.fleet_type_id)::integer
      from public.flight_bookings booking
      join public.aircraft aircraft
        on aircraft.id = booking.aircraft_id
      where booking.pilot_id = v_user_id
        and booking.status = 'completed'
    )
  )
  into v_summary;

  return jsonb_build_object(
    'schemaVersion', 1,
    'projection', 'museum-history.pilot',
    'authority', 'read-only-derived',
    'summary', coalesce(v_summary, '{}'::jsonb),
    'memories', jsonb_build_object(
      'firstCompletedFlight', coalesce(v_first_flight, '{}'::jsonb),
      'mostFlownAircraftType', coalesce(v_favorite_aircraft, '{}'::jsonb),
      'latestPromotion', coalesce(v_latest_promotion, '{}'::jsonb),
      'firstEventAchievement', coalesce(v_first_event_achievement, '{}'::jsonb)
    ),
    'timeline', coalesce(v_timeline, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_pilot_museum_history()
from public, anon;

grant execute on function public.get_pilot_museum_history()
to authenticated;

comment on function public.get_pilot_museum_history()
is 'Pillar 09 read-only derived pilot Museum / History projection. Existing operational systems remain authoritative.';
