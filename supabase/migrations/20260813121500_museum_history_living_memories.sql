-- KVA OS — Pillar 09 Museum & History v1.0 COMPLETE
-- Living Memories / Anniversaries
--
-- This is a read-only legacy layer. It derives memory dates from existing
-- authoritative evidence and published curated company history.
--
-- It does NOT:
--   - award Career XP or ranks
--   - change wallets or company KVC
--   - write Economy Ledger
--   - activate routes
--   - mutate fleet registrations
--   - change PIREPs
--   - invent historical dates

create or replace function public.museum_safe_annual_date(
  p_source_date date,
  p_year integer
)
returns date
language sql
immutable
strict
as $$
  select make_date(
    p_year,
    extract(month from p_source_date)::integer,
    least(
      extract(day from p_source_date)::integer,
      extract(
        day from (
          date_trunc(
            'month',
            make_date(
              p_year,
              extract(month from p_source_date)::integer,
              1
            )
          ) + interval '1 month - 1 day'
        )
      )::integer
    )
  );
$$;

revoke all on function public.museum_safe_annual_date(date, integer)
from public, anon;

grant execute on function public.museum_safe_annual_date(date, integer)
to authenticated;


create or replace function public.museum_next_anniversary_date(
  p_source_date date,
  p_reference_date date default current_date
)
returns date
language plpgsql
immutable
strict
as $$
declare
  v_candidate date;
  v_year integer := extract(year from p_reference_date)::integer;
begin
  v_candidate := public.museum_safe_annual_date(p_source_date, v_year);

  if v_candidate >= p_reference_date then
    return v_candidate;
  end if;

  return public.museum_safe_annual_date(p_source_date, v_year + 1);
end;
$$;

revoke all on function public.museum_next_anniversary_date(date, date)
from public, anon;

grant execute on function public.museum_next_anniversary_date(date, date)
to authenticated;


create or replace function public.get_pilot_museum_living_memories()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id text;
  v_today date := current_date;
  v_passport_issued date;
  v_journey jsonb := '{}'::jsonb;
  v_on_this_day jsonb := '[]'::jsonb;
  v_upcoming jsonb := '[]'::jsonb;
  v_source_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select account.organization_id
  into v_org_id
  from public.pilot_career_accounts account
  where account.pilot_id = v_user_id;

  select passport.issued_at::date
  into v_passport_issued
  from public.pilot_passports passport
  where passport.pilot_id = v_user_id
  order by passport.issued_at
  limit 1;

  if v_passport_issued is not null then
    v_journey := jsonb_build_object(
      'startedOn', v_passport_issued,
      'days', greatest(0, v_today - v_passport_issued),
      'years',
        greatest(
          0,
          extract(year from age(v_today, v_passport_issued))::integer
        ),
      'nextAnniversary',
        public.museum_next_anniversary_date(v_passport_issued, v_today),
      'nextAnniversaryNumber',
        (
          extract(
            year from age(
              public.museum_next_anniversary_date(v_passport_issued, v_today),
              v_passport_issued
            )
          )::integer
        )
    );
  end if;

  with memory_sources as (
    -- Universal Pilot Passport / journey identity
    select
      'passport:' || passport.pilot_id::text as item_id,
      'pilot'::text as scope,
      'journey_anniversary'::text as kind,
      passport.issued_at::date as source_date,
      'Your KVA OS journey began'::text as title,
      (
        'Universal Pilot Passport ' || passport.passport_number ||
        ' became part of your persistent aviation identity.'
      )::text as description,
      jsonb_build_object(
        'pilotId', passport.pilot_id,
        'passportNumber', passport.passport_number,
        'source', 'pilot_passports'
      ) as evidence
    from public.pilot_passports passport
    where passport.pilot_id = v_user_id

    union all

    -- Completed flights: every completed operation can return as a memory.
    select
      'flight:' || booking.id::text,
      'pilot',
      'flight_anniversary',
      booking.completed_at::date,
      (route.flight_number || ' flight memory')::text,
      (
        coalesce(departure.icao_code, '----') || ' → ' ||
        coalesce(arrival.icao_code, '----') ||
        case
          when fleet.icao_code is not null
            then ' · ' || fleet.icao_code
          else ''
        end
      )::text,
      jsonb_build_object(
        'bookingId', booking.id,
        'routeId', route.id,
        'flightNumber', route.flight_number,
        'departureIcao', departure.icao_code,
        'arrivalIcao', arrival.icao_code,
        'aircraftId', aircraft.id,
        'registration', aircraft.registration,
        'fleetIcao', fleet.icao_code,
        'source', 'flight_bookings'
      )
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
      and booking.completed_at is not null

    union all

    -- Career milestones
    select
      'milestone:' || achieved.id::text,
      'pilot',
      'milestone_anniversary',
      achieved.achieved_at::date,
      definition.title,
      definition.description,
      jsonb_build_object(
        'milestoneId', definition.id,
        'milestoneCode', definition.code,
        'metric', definition.metric,
        'threshold', definition.threshold,
        'sourcePirepId', achieved.source_pirep_id,
        'source', 'pilot_career_milestones'
      )
    from public.pilot_career_milestones achieved
    join public.career_milestone_definitions definition
      on definition.id = achieved.milestone_id
    where achieved.pilot_id = v_user_id

    union all

    -- Career promotions
    select
      'promotion:' || promotion.id::text,
      'pilot',
      'promotion_anniversary',
      promotion.promoted_at::date,
      ('Promotion to ' || promotion.to_rank_code)::text,
      (
        case
          when promotion.from_rank_code is null
            then 'Your recorded KVA OS career rank became ' ||
              promotion.to_rank_code || '.'
          else
            'Your career progressed from ' || promotion.from_rank_code ||
            ' to ' || promotion.to_rank_code || '.'
        end
      )::text,
      jsonb_build_object(
        'promotionId', promotion.id,
        'fromRankCode', promotion.from_rank_code,
        'toRankCode', promotion.to_rank_code,
        'careerXp', promotion.career_xp,
        'completedFlights', promotion.completed_flights,
        'sourcePirepId', promotion.source_pirep_id,
        'source', 'career_promotion_history'
      )
    from public.career_promotion_history promotion
    where promotion.pilot_id = v_user_id

    union all

    -- Aircraft qualification anniversaries
    select
      'qualification:' || rating.id::text,
      'pilot',
      'qualification_anniversary',
      rating.issued_at::date,
      (fleet.icao_code || ' qualification memory')::text,
      (
        fleet.manufacturer || ' ' || fleet.model ||
        ' entered your recorded aircraft qualifications.'
      )::text,
      jsonb_build_object(
        'ratingId', rating.id,
        'fleetTypeId', fleet.id,
        'fleetIcao', fleet.icao_code,
        'expiresAt', rating.expires_at,
        'active', rating.is_active,
        'source', 'pilot_type_ratings'
      )
    from public.pilot_type_ratings rating
    join public.fleet_types fleet
      on fleet.id = rating.fleet_type_id
    where rating.pilot_id = v_user_id

    union all

    -- Global event achievement anniversaries
    select
      'event:' || achievement.id::text,
      'pilot',
      'event_anniversary',
      achievement.awarded_at::date,
      achievement.badge_name,
      ('Earned during ' || event.title || '.')::text,
      jsonb_build_object(
        'achievementId', achievement.id,
        'eventId', event.id,
        'eventCode', event.code,
        'eventTitle', event.title,
        'badgeCode', achievement.badge_code,
        'source', 'global_aviation_event_achievements'
      )
    from public.global_aviation_event_achievements achievement
    join public.global_aviation_events event
      on event.id = achievement.event_id
    where achievement.pilot_id = v_user_id

    union all

    -- Published company memories with a real curated date.
    select
      'company-curated:' || entry.id::text,
      'company',
      'company_anniversary',
      entry.occurred_on,
      entry.title,
      entry.summary,
      jsonb_build_object(
        'historyEntryId', entry.id,
        'category', entry.category,
        'eraLabel', entry.era_label,
        'sourceEvidence', entry.evidence,
        'source', 'museum_company_history_entries'
      )
    from public.museum_company_history_entries entry
    where entry.organization_id = v_org_id
      and entry.is_published
      and entry.occurred_on is not null
  ),
  valid_sources as (
    select *
    from memory_sources
    where source_date is not null
      and source_date <= v_today
  ),
  decorated as (
    select
      source.*,
      greatest(
        0,
        extract(year from age(v_today, source.source_date))::integer
      ) as years_since,
      public.museum_next_anniversary_date(
        source.source_date,
        v_today
      ) as next_anniversary
    from valid_sources source
  )
  select
    count(*)::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', item_id,
          'scope', scope,
          'kind', kind,
          'sourceDate', source_date,
          'yearsAgo', years_since,
          'title', title,
          'description', description,
          'evidence', evidence
        )
        order by scope, kind, item_id
      ) filter (
        where years_since >= 1
          and extract(month from source_date) =
            extract(month from v_today)
          and extract(day from source_date) =
            extract(day from v_today)
      ),
      '[]'::jsonb
    )
  into v_source_count, v_on_this_day
  from decorated;

  with memory_sources as (
    select
      'passport:' || passport.pilot_id::text as item_id,
      'pilot'::text as scope,
      'journey_anniversary'::text as kind,
      passport.issued_at::date as source_date,
      'KVA OS Journey Anniversary'::text as title,
      (
        'The anniversary of your Universal Pilot Passport and persistent KVA OS identity.'
      )::text as description
    from public.pilot_passports passport
    where passport.pilot_id = v_user_id

    union all

    select
      'flight:' || booking.id::text,
      'pilot',
      'flight_anniversary',
      booking.completed_at::date,
      (route.flight_number || ' Anniversary')::text,
      (
        coalesce(departure.icao_code, '----') || ' → ' ||
        coalesce(arrival.icao_code, '----') ||
        case
          when fleet.icao_code is not null
            then ' · ' || fleet.icao_code
          else ''
        end
      )::text
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
      and booking.completed_at is not null

    union all

    select
      'milestone:' || achieved.id::text,
      'pilot',
      'milestone_anniversary',
      achieved.achieved_at::date,
      definition.title,
      definition.description
    from public.pilot_career_milestones achieved
    join public.career_milestone_definitions definition
      on definition.id = achieved.milestone_id
    where achieved.pilot_id = v_user_id

    union all

    select
      'promotion:' || promotion.id::text,
      'pilot',
      'promotion_anniversary',
      promotion.promoted_at::date,
      ('Promotion to ' || promotion.to_rank_code)::text,
      'A recorded KVA OS career promotion.'::text
    from public.career_promotion_history promotion
    where promotion.pilot_id = v_user_id

    union all

    select
      'qualification:' || rating.id::text,
      'pilot',
      'qualification_anniversary',
      rating.issued_at::date,
      (fleet.icao_code || ' Qualification Anniversary')::text,
      (fleet.manufacturer || ' ' || fleet.model)::text
    from public.pilot_type_ratings rating
    join public.fleet_types fleet
      on fleet.id = rating.fleet_type_id
    where rating.pilot_id = v_user_id

    union all

    select
      'event:' || achievement.id::text,
      'pilot',
      'event_anniversary',
      achievement.awarded_at::date,
      achievement.badge_name,
      ('Global Aviation Event: ' || event.title)::text
    from public.global_aviation_event_achievements achievement
    join public.global_aviation_events event
      on event.id = achievement.event_id
    where achievement.pilot_id = v_user_id

    union all

    select
      'company-curated:' || entry.id::text,
      'company',
      'company_anniversary',
      entry.occurred_on,
      entry.title,
      entry.summary
    from public.museum_company_history_entries entry
    where entry.organization_id = v_org_id
      and entry.is_published
      and entry.occurred_on is not null
  ),
  valid_sources as (
    select *
    from memory_sources
    where source_date is not null
      and source_date <= v_today
  ),
  decorated as (
    select
      source.*,
      public.museum_next_anniversary_date(
        source.source_date,
        v_today
      ) as next_anniversary
    from valid_sources source
  ),
  nearest as (
    select
      *,
      (next_anniversary - v_today)::integer as days_until,
      greatest(
        1,
        extract(
          year from age(next_anniversary, source_date)
        )::integer
      ) as anniversary_number
    from decorated
    order by next_anniversary, scope, kind, item_id
    limit 10
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item_id,
        'scope', scope,
        'kind', kind,
        'sourceDate', source_date,
        'nextDate', next_anniversary,
        'daysUntil', days_until,
        'anniversaryNumber', anniversary_number,
        'title', title,
        'description', description
      )
      order by next_anniversary, scope, kind, item_id
    ),
    '[]'::jsonb
  )
  into v_upcoming
  from nearest;

  return jsonb_build_object(
    'schemaVersion', 1,
    'projection', 'museum-history.living-memories',
    'authority', 'read-only-derived',
    'today', v_today,
    'organizationId', v_org_id,
    'journey', coalesce(v_journey, '{}'::jsonb),
    'sourceCount', v_source_count,
    'onThisDay', coalesce(v_on_this_day, '[]'::jsonb),
    'upcomingAnniversaries', coalesce(v_upcoming, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_pilot_museum_living_memories()
from public, anon;

grant execute on function public.get_pilot_museum_living_memories()
to authenticated;

comment on function public.get_pilot_museum_living_memories()
is 'Pillar 09 Living Memories: read-only On This Day and anniversary projection from authoritative KVA OS evidence and dated published curated company history.';
