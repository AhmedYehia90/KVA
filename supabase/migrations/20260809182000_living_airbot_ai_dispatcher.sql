-- KVA Living Airbot / AI Dispatcher Pack v1.0
-- Evidence-backed live dispatcher sessions for KVA OS pilots.

create table if not exists public.living_airbot_sessions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique
    references public.flight_bookings(id) on delete cascade,
  pilot_id uuid not null
    references public.profiles(id) on delete cascade,
  organization_id text not null default 'kalabsha-airlines'
    references public.platform_organizations(id) on delete restrict,
  route_id uuid not null
    references public.routes(id) on delete restrict,
  dispatch_id uuid
    references public.dispatches(id) on delete set null,
  aircraft_id uuid
    references public.aircraft(id) on delete set null,
  flight_number text not null,
  phase text not null check (
    phase in (
      'preflight',
      'boarding',
      'ground_departure',
      'airborne',
      'arrived',
      'completed'
    )
  ),
  readiness text not null check (
    readiness in ('ready', 'attention', 'blocked')
  ),
  readiness_score integer not null check (
    readiness_score between 0 and 100
  ),
  status text not null default 'active' check (
    status in ('active', 'completed')
  ),
  summary text not null,
  next_step text not null,
  evidence jsonb not null default '{}'::jsonb,
  checks jsonb not null default '[]'::jsonb,
  last_source_event_id uuid
    references public.platform_events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_living_airbot_sessions_pilot_updated
on public.living_airbot_sessions(pilot_id, updated_at desc);

create index if not exists idx_living_airbot_sessions_status
on public.living_airbot_sessions(pilot_id, status, updated_at desc);

create table if not exists public.living_airbot_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.living_airbot_sessions(id) on delete cascade,
  pilot_id uuid not null
    references public.profiles(id) on delete cascade,
  role text not null check (
    role in ('dispatcher', 'pilot', 'system')
  ),
  intent text,
  message text not null,
  source_event_id uuid
    references public.platform_events(id) on delete set null,
  created_at timestamptz not null default now(),
  check (char_length(message) between 1 and 4000)
);

create index if not exists idx_living_airbot_messages_session_created
on public.living_airbot_messages(session_id, created_at desc);

create index if not exists idx_living_airbot_messages_pilot_created
on public.living_airbot_messages(pilot_id, created_at desc);

alter table public.living_airbot_sessions enable row level security;
alter table public.living_airbot_messages enable row level security;

drop policy if exists living_airbot_sessions_select_own
on public.living_airbot_sessions;

create policy living_airbot_sessions_select_own
on public.living_airbot_sessions
for select
to authenticated
using (auth.uid() = pilot_id);

drop policy if exists living_airbot_messages_select_own
on public.living_airbot_messages;

create policy living_airbot_messages_select_own
on public.living_airbot_messages
for select
to authenticated
using (auth.uid() = pilot_id);


create or replace function public.sync_living_airbot_session(
  p_booking_id uuid,
  p_source_event_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.flight_bookings%rowtype;
  v_route public.routes%rowtype;
  v_dispatch public.dispatches%rowtype;
  v_aircraft public.aircraft%rowtype;
  v_departure text;
  v_arrival text;
  v_aircraft_type text;
  v_phase text;
  v_readiness text;
  v_readiness_score integer;
  v_summary text;
  v_next_step text;
  v_checks jsonb;
  v_evidence jsonb;
  v_session public.living_airbot_sessions%rowtype;
  v_session_id uuid;
  v_event_type text;
  v_message text;
  v_passed_count integer := 0;
  v_blocked boolean := false;
  v_dispatch_available boolean := false;
  v_aircraft_assigned boolean := false;
  v_aircraft_active boolean := false;
begin
  select *
  into v_booking
  from public.flight_bookings
  where id = p_booking_id;

  if not found then
    raise exception 'Flight booking not found';
  end if;

  select *
  into v_route
  from public.routes
  where id = v_booking.route_id;

  if not found then
    raise exception 'Route not found';
  end if;

  select airport.icao_code
  into v_departure
  from public.airports airport
  where airport.id = v_route.departure_airport_id;

  select airport.icao_code
  into v_arrival
  from public.airports airport
  where airport.id = v_route.arrival_airport_id;

  select *
  into v_dispatch
  from public.dispatches
  where booking_id = v_booking.id
  limit 1;

  v_dispatch_available := found;

  if v_booking.aircraft_id is not null then
    select *
    into v_aircraft
    from public.aircraft
    where id = v_booking.aircraft_id;

    v_aircraft_assigned := found;
  end if;

  if v_aircraft_assigned then
    select fleet_type.icao_code
    into v_aircraft_type
    from public.fleet_types fleet_type
    where fleet_type.id = v_aircraft.fleet_type_id;

    v_aircraft_active := v_aircraft.status = 'active';
  end if;

  if v_route.active then
    v_passed_count := v_passed_count + 1;
  else
    v_blocked := true;
  end if;

  if v_dispatch_available then
    v_passed_count := v_passed_count + 1;
  else
    v_blocked := true;
  end if;

  if v_aircraft_assigned then
    v_passed_count := v_passed_count + 1;
  end if;

  if v_aircraft_active then
    v_passed_count := v_passed_count + 1;
  end if;

  v_readiness_score := round(v_passed_count::numeric / 4 * 100);

  v_readiness := case
    when v_blocked then 'blocked'
    when v_readiness_score = 100 then 'ready'
    else 'attention'
  end;

  v_phase := case v_booking.status
    when 'boarding' then 'boarding'
    when 'departed' then 'ground_departure'
    when 'enroute' then 'airborne'
    when 'landed' then 'arrived'
    when 'completed' then 'completed'
    else 'preflight'
  end;

  v_summary := case v_readiness
    when 'ready' then
      format(
        '%s is fully dispatch-ready for %s → %s from the recorded KVA OS evidence.',
        v_route.flight_number,
        coalesce(v_departure, '—'),
        coalesce(v_arrival, '—')
      )
    when 'blocked' then
      format(
        '%s has a blocking dispatch issue that must be resolved before continuing.',
        v_route.flight_number
      )
    else
      format(
        '%s is operationally available with attention items still visible in the briefing.',
        v_route.flight_number
      )
  end;

  v_next_step := case
    when v_readiness = 'blocked' then
      'Resolve the blocking dispatch check before continuing the flight workflow.'
    when v_phase = 'preflight' and v_readiness = 'ready' then
      'Review the dispatch evidence, then continue to boarding when you are satisfied.'
    when v_phase = 'preflight' then
      'Review the attention items before moving from preflight to boarding.'
    when v_phase = 'boarding' then
      'Confirm the recorded flight details remain correct before departure.'
    when v_phase = 'ground_departure' then
      'Continue the departure workflow and use recorded operational data for any decision.'
    when v_phase = 'airborne' then
      'Monitor the flight and keep the dispatcher record aligned with KVA OS events.'
    when v_phase = 'arrived' then
      'Complete the flight workflow, then prepare the PIREP from recorded values.'
    else
      'The flight is complete. Submit or review the PIREP and post-flight systems.'
  end;

  v_checks := jsonb_build_array(
    jsonb_build_object(
      'code', 'route_available',
      'label', 'Published route',
      'passed', v_route.active,
      'blocking', true,
      'detail', case
        when v_route.active then
          'The booked route is available in KVA OS.'
        else
          'The booked route is not currently active.'
      end
    ),
    jsonb_build_object(
      'code', 'dispatch_available',
      'label', 'Dispatch record',
      'passed', v_dispatch_available,
      'blocking', true,
      'detail', case
        when v_dispatch_available then
          'A dispatch record exists for this booking.'
        else
          'No dispatch record is available for this booking.'
      end
    ),
    jsonb_build_object(
      'code', 'aircraft_assigned',
      'label', 'Aircraft assignment',
      'passed', v_aircraft_assigned,
      'blocking', false,
      'detail', case
        when v_aircraft_assigned then
          format(
            'Assigned aircraft: %s.',
            coalesce(v_aircraft.registration, 'recorded aircraft')
          )
        else
          'Aircraft assignment is still pending.'
      end
    ),
    jsonb_build_object(
      'code', 'aircraft_operational',
      'label', 'Aircraft operational state',
      'passed', v_aircraft_active,
      'blocking', false,
      'detail', case
        when not v_aircraft_assigned then
          'Cannot confirm aircraft state until an aircraft is assigned.'
        when v_aircraft_active then
          'The assigned aircraft is active in the fleet record.'
        else
          format(
            'Aircraft state is %s.',
            coalesce(v_aircraft.status::text, 'unknown')
          )
      end
    )
  );

  v_evidence := jsonb_build_object(
    'flightNumber', v_route.flight_number,
    'departure', v_departure,
    'arrival', v_arrival,
    'scheduledMinutes', v_route.scheduled_minutes,
    'bookingStatus', v_booking.status,
    'dispatchAvailable', v_dispatch_available,
    'dispatchId', case
      when v_dispatch_available then v_dispatch.id
      else null
    end,
    'aircraftAssigned', v_aircraft_assigned,
    'aircraftId', v_booking.aircraft_id,
    'aircraftRegistration', case
      when v_aircraft_assigned then v_aircraft.registration
      else null
    end,
    'aircraftType', v_aircraft_type,
    'aircraftStatus', case
      when v_aircraft_assigned then v_aircraft.status
      else null
    end,
    'routeActive', v_route.active
  );

  select *
  into v_session
  from public.living_airbot_sessions
  where booking_id = v_booking.id;

  if not found then
    insert into public.living_airbot_sessions (
      booking_id,
      pilot_id,
      organization_id,
      route_id,
      dispatch_id,
      aircraft_id,
      flight_number,
      phase,
      readiness,
      readiness_score,
      status,
      summary,
      next_step,
      evidence,
      checks,
      last_source_event_id,
      completed_at,
      created_at,
      updated_at
    )
    values (
      v_booking.id,
      v_booking.pilot_id,
      'kalabsha-airlines',
      v_booking.route_id,
      case when v_dispatch_available then v_dispatch.id else null end,
      v_booking.aircraft_id,
      v_route.flight_number,
      v_phase,
      v_readiness,
      v_readiness_score,
      case when v_phase = 'completed' then 'completed' else 'active' end,
      v_summary,
      v_next_step,
      v_evidence,
      v_checks,
      p_source_event_id,
      case when v_phase = 'completed' then now() else null end,
      now(),
      now()
    )
    returning id into v_session_id;

    v_event_type := 'airbot.session_created';
    v_message := format(
      'Dispatch session opened for %s. %s',
      v_route.flight_number,
      v_summary
    );

    insert into public.living_airbot_messages (
      session_id,
      pilot_id,
      role,
      intent,
      message,
      source_event_id
    )
    values (
      v_session_id,
      v_booking.pilot_id,
      'dispatcher',
      'session_update',
      v_message,
      p_source_event_id
    );
  else
    v_session_id := v_session.id;
    v_event_type := null;

    update public.living_airbot_sessions
    set
      dispatch_id = case
        when v_dispatch_available then v_dispatch.id
        else null
      end,
      aircraft_id = v_booking.aircraft_id,
      phase = v_phase,
      readiness = v_readiness,
      readiness_score = v_readiness_score,
      status = case
        when v_phase = 'completed' then 'completed'
        else 'active'
      end,
      summary = v_summary,
      next_step = v_next_step,
      evidence = v_evidence,
      checks = v_checks,
      last_source_event_id = coalesce(
        p_source_event_id,
        last_source_event_id
      ),
      completed_at = case
        when v_phase = 'completed' then coalesce(completed_at, now())
        else null
      end,
      updated_at = now()
    where id = v_session.id;

    if v_session.phase is distinct from v_phase
       or v_session.readiness is distinct from v_readiness
       or v_session.readiness_score is distinct from v_readiness_score then
      v_event_type := 'airbot.session_updated';
      v_message := format(
        '%s update: phase is %s and dispatch readiness is %s (%s%%). %s',
        v_route.flight_number,
        replace(v_phase, '_', ' '),
        v_readiness,
        v_readiness_score,
        v_next_step
      );

      insert into public.living_airbot_messages (
        session_id,
        pilot_id,
        role,
        intent,
        message,
        source_event_id
      )
      values (
        v_session_id,
        v_booking.pilot_id,
        'dispatcher',
        'session_update',
        v_message,
        p_source_event_id
      );
    end if;
  end if;

  if v_event_type is not null then
    perform public.append_domain_event(
      p_event_type => v_event_type,
      p_aggregate_type => 'living_airbot_session',
      p_aggregate_id => v_session_id::text,
      p_actor_id => v_booking.pilot_id::text,
      p_organization_id => 'kalabsha-airlines',
      p_payload => jsonb_build_object(
        'sessionId', v_session_id,
        'bookingId', v_booking.id,
        'pilotId', v_booking.pilot_id,
        'flightNumber', v_route.flight_number,
        'phase', v_phase,
        'readiness', v_readiness,
        'readinessScore', v_readiness_score,
        'sourceEventId', p_source_event_id
      ),
      p_metadata => jsonb_build_object(
        'source', 'living-airbot.v1',
        'privacy', 'pilot_private',
        'explainable', true
      )
    );
  end if;

  return v_session_id;
end;
$$;

revoke all on function public.sync_living_airbot_session(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.sync_living_airbot_session(uuid, uuid)
to service_role;


create or replace function public.ask_living_airbot(
  p_session_id uuid,
  p_intent text,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.living_airbot_sessions%rowtype;
  v_response text;
  v_pilot_message text;
  v_response_id uuid;
  v_failed_labels text;
  v_normalized text := lower(coalesce(p_message, ''));
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_intent not in (
    'briefing',
    'readiness',
    'aircraft',
    'next_step',
    'custom'
  ) then
    raise exception 'Invalid Airbot intent';
  end if;

  if p_message is not null
     and char_length(btrim(p_message)) > 2000 then
    raise exception 'Airbot message cannot exceed 2000 characters';
  end if;

  select *
  into v_session
  from public.living_airbot_sessions
  where id = p_session_id
    and pilot_id = v_user_id;

  if not found then
    raise exception 'Living Airbot session not found';
  end if;

  v_pilot_message := case p_intent
    when 'briefing' then 'Give me the dispatch briefing.'
    when 'readiness' then 'What is the current readiness?'
    when 'aircraft' then 'What aircraft is assigned?'
    when 'next_step' then 'What should I do next?'
    else btrim(coalesce(p_message, ''))
  end;

  if p_intent = 'custom' and v_pilot_message = '' then
    raise exception 'A custom Airbot message is required';
  end if;

  insert into public.living_airbot_messages (
    session_id,
    pilot_id,
    role,
    intent,
    message
  )
  values (
    v_session.id,
    v_user_id,
    'pilot',
    p_intent,
    v_pilot_message
  );

  if p_intent = 'briefing' then
    v_response := format(
      '%s Planned block time: %s minutes.',
      v_session.summary,
      coalesce(
        v_session.evidence ->> 'scheduledMinutes',
        'not recorded'
      )
    );

  elsif p_intent = 'readiness' then
    select string_agg(item.value ->> 'label', ', ')
    into v_failed_labels
    from jsonb_array_elements(v_session.checks) as item(value)
    where coalesce(
      (item.value ->> 'passed')::boolean,
      false
    ) = false;

    if v_failed_labels is null then
      v_response := format(
        'Readiness is %s%%. All recorded dispatch checks pass.',
        v_session.readiness_score
      );
    else
      v_response := format(
        'Readiness is %s%%. Review: %s.',
        v_session.readiness_score,
        v_failed_labels
      );
    end if;

  elsif p_intent = 'aircraft' then
    if coalesce(
      (v_session.evidence ->> 'aircraftAssigned')::boolean,
      false
    ) = false then
      v_response :=
        'No aircraft is assigned yet. I will keep the assignment visible as pending rather than inventing one.';
    else
      v_response := format(
        'Aircraft %s%s is recorded with fleet state %s.',
        coalesce(
          v_session.evidence ->> 'aircraftRegistration',
          'assigned'
        ),
        case
          when nullif(v_session.evidence ->> 'aircraftType', '') is null
            then ''
          else format(
            ' (%s)',
            v_session.evidence ->> 'aircraftType'
          )
        end,
        coalesce(
          v_session.evidence ->> 'aircraftStatus',
          'unknown'
        )
      );
    end if;

  elsif p_intent = 'next_step' then
    v_response := v_session.next_step;

  else
    if v_normalized like '%aircraft%'
       or v_normalized like '%plane%' then
      if coalesce(
        (v_session.evidence ->> 'aircraftAssigned')::boolean,
        false
      ) = false then
        v_response :=
          'No aircraft is assigned yet. I will keep the assignment visible as pending rather than inventing one.';
      else
        v_response := format(
          'Aircraft %s%s is recorded with fleet state %s.',
          coalesce(
            v_session.evidence ->> 'aircraftRegistration',
            'assigned'
          ),
          case
            when nullif(
              v_session.evidence ->> 'aircraftType',
              ''
            ) is null then ''
            else format(
              ' (%s)',
              v_session.evidence ->> 'aircraftType'
            )
          end,
          coalesce(
            v_session.evidence ->> 'aircraftStatus',
            'unknown'
          )
        );
      end if;

    elsif v_normalized like '%ready%'
       or v_normalized like '%readiness%'
       or v_normalized like '%check%' then
      select string_agg(item.value ->> 'label', ', ')
      into v_failed_labels
      from jsonb_array_elements(v_session.checks) as item(value)
      where coalesce(
        (item.value ->> 'passed')::boolean,
        false
      ) = false;

      if v_failed_labels is null then
        v_response := format(
          'Readiness is %s%%. All recorded dispatch checks pass.',
          v_session.readiness_score
        );
      else
        v_response := format(
          'Readiness is %s%%. Review: %s.',
          v_session.readiness_score,
          v_failed_labels
        );
      end if;

    elsif v_normalized like '%route%'
       or v_normalized like '%flight%'
       or v_normalized like '%brief%' then
      v_response := format(
        '%s Planned block time: %s minutes.',
        v_session.summary,
        coalesce(
          v_session.evidence ->> 'scheduledMinutes',
          'not recorded'
        )
      );

    else
      v_response := format(
        'I can only answer from recorded KVA OS dispatch evidence. Current phase: %s. %s',
        replace(v_session.phase, '_', ' '),
        v_session.next_step
      );
    end if;
  end if;

  insert into public.living_airbot_messages (
    session_id,
    pilot_id,
    role,
    intent,
    message
  )
  values (
    v_session.id,
    v_user_id,
    'dispatcher',
    p_intent,
    v_response
  )
  returning id into v_response_id;

  perform public.append_domain_event(
    p_event_type => 'airbot.interaction_recorded',
    p_aggregate_type => 'living_airbot_session',
    p_aggregate_id => v_session.id::text,
    p_actor_id => v_user_id::text,
    p_organization_id => v_session.organization_id,
    p_payload => jsonb_build_object(
      'sessionId', v_session.id,
      'bookingId', v_session.booking_id,
      'pilotId', v_user_id,
      'flightNumber', v_session.flight_number,
      'intent', p_intent,
      'responseMessageId', v_response_id
    ),
    p_metadata => jsonb_build_object(
      'source', 'living-airbot.pilot',
      'privacy', 'pilot_private',
      'bounded', true
    )
  );

  return v_response_id;
end;
$$;

revoke all on function public.ask_living_airbot(uuid, text, text)
from public, anon;

grant execute on function public.ask_living_airbot(uuid, text, text)
to authenticated;

create or replace function public.handle_living_airbot_flight_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
begin
  if new.event_type not in (
    'flight.booked',
    'aircraft.assigned',
    'dispatch.created',
    'flight.boarding_started',
    'flight.pushback_started',
    'flight.takeoff_recorded',
    'flight.landing_recorded',
    'flight.completed'
  ) then
    return new;
  end if;

  begin
    v_booking_id := nullif(
      new.payload ->> 'bookingId',
      ''
    )::uuid;
  exception
    when invalid_text_representation then
      return new;
  end;

  if v_booking_id is not null then
    perform public.sync_living_airbot_session(
      v_booking_id,
      new.id
    );
  end if;

  return new;
end;
$$;

revoke all on function public.handle_living_airbot_flight_event()
from public, anon, authenticated;

drop trigger if exists zzzz_after_platform_event_living_airbot
on public.platform_events;

create trigger zzzz_after_platform_event_living_airbot
after insert on public.platform_events
for each row
when (
  new.event_type in (
    'flight.booked',
    'aircraft.assigned',
    'dispatch.created',
    'flight.boarding_started',
    'flight.pushback_started',
    'flight.takeoff_recorded',
    'flight.landing_recorded',
    'flight.completed'
  )
)
execute function public.handle_living_airbot_flight_event();

-- Backfill one dispatcher session for each existing booking.
do $$
declare
  v_record record;
begin
  for v_record in
    select booking.id
    from public.flight_bookings booking
    order by booking.created_at, booking.id
  loop
    perform public.sync_living_airbot_session(
      v_record.id,
      null
    );
  end loop;
end
$$;
