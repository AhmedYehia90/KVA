-- KVA Core Completion Pack v1.0
-- Event Reliability + Aircraft State Sync + Auto PIREP

-- ===========================================================================
-- EVENT RELIABILITY
-- ===========================================================================

alter table public.event_processing_log
  add column if not exists max_attempts integer not null default 5,
  add column if not exists next_retry_at timestamptz,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists dead_lettered_at timestamptz;

alter table public.event_processing_log
  drop constraint if exists event_processing_log_max_attempts_check;

alter table public.event_processing_log
  add constraint event_processing_log_max_attempts_check
  check (max_attempts between 1 and 100);

create index if not exists idx_event_processing_retry_due
on public.event_processing_log(status, next_retry_at)
where status in ('FAILED', 'PENDING');

create table if not exists public.event_dead_letters (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.platform_events(id) on delete cascade,
  consumer_name text not null,
  attempts integer not null,
  last_error text,
  payload_snapshot jsonb not null default '{}'::jsonb,
  metadata_snapshot jsonb not null default '{}'::jsonb,
  dead_lettered_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, consumer_name)
);

create index if not exists idx_event_dead_letters_open
on public.event_dead_letters(dead_lettered_at desc)
where resolved_at is null;

alter table public.event_dead_letters enable row level security;

create or replace function public.process_operations_event_reliably(
  p_event_id uuid
)
returns public."EventProcessingStatus"
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log public.event_processing_log%rowtype;
  v_event public.platform_events%rowtype;
  v_delay integer;
begin
  perform public.project_operations_event(p_event_id);

  select *
  into v_log
  from public.event_processing_log
  where event_id = p_event_id
    and consumer_name = 'operations.projector';

  if not found then
    return null;
  end if;

  if v_log.status = 'PROCESSED' then
    update public.event_processing_log
    set
      next_retry_at = null,
      dead_lettered_at = null,
      last_attempt_at = now(),
      updated_at = now()
    where id = v_log.id;

    update public.event_dead_letters
    set
      resolved_at = coalesce(resolved_at, now()),
      resolution = coalesce(resolution, 'processed'),
      updated_at = now()
    where event_id = p_event_id
      and consumer_name = 'operations.projector'
      and resolved_at is null;

    return 'PROCESSED';
  end if;

  if v_log.status = 'FAILED' and v_log.attempts >= v_log.max_attempts then
    select *
    into v_event
    from public.platform_events
    where id = p_event_id;

    update public.event_processing_log
    set
      status = 'DEAD_LETTER',
      next_retry_at = null,
      dead_lettered_at = now(),
      last_attempt_at = now(),
      updated_at = now()
    where id = v_log.id;

    insert into public.event_dead_letters (
      event_id,
      consumer_name,
      attempts,
      last_error,
      payload_snapshot,
      metadata_snapshot,
      dead_lettered_at,
      resolved_at,
      resolution,
      updated_at
    )
    values (
      p_event_id,
      'operations.projector',
      v_log.attempts,
      v_log.last_error,
      coalesce(v_event.payload, '{}'::jsonb),
      coalesce(v_event.metadata, '{}'::jsonb),
      now(),
      null,
      null,
      now()
    )
    on conflict (event_id, consumer_name)
    do update set
      attempts = excluded.attempts,
      last_error = excluded.last_error,
      payload_snapshot = excluded.payload_snapshot,
      metadata_snapshot = excluded.metadata_snapshot,
      dead_lettered_at = excluded.dead_lettered_at,
      resolved_at = null,
      resolution = null,
      updated_at = now();

    return 'DEAD_LETTER';
  end if;

  if v_log.status = 'FAILED' then
    v_delay := least(
      3600,
      (30 * power(2, greatest(0, v_log.attempts - 1)))::integer
    );

    update public.event_processing_log
    set
      next_retry_at = now() + make_interval(secs => v_delay),
      last_attempt_at = now(),
      updated_at = now()
    where id = v_log.id;

    return 'FAILED';
  end if;

  update public.event_processing_log
  set last_attempt_at = now(), updated_at = now()
  where id = v_log.id;

  return v_log.status;
end;
$$;

revoke all on function public.process_operations_event_reliably(uuid)
from public, anon, authenticated;
grant execute on function public.process_operations_event_reliably(uuid)
to service_role;

create or replace function public.retry_operations_projection(
  p_limit integer default 100
)
returns table(event_id uuid, processed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record record;
  v_status public."EventProcessingStatus";
begin
  for v_record in
    select events.id
    from public.platform_events events
    left join public.event_processing_log processing
      on processing.event_id = events.id
     and processing.consumer_name = 'operations.projector'
    where events.event_type in (
      'flight.booked',
      'aircraft.assigned',
      'dispatch.created',
      'flight.boarding_started',
      'flight.pushback_started',
      'flight.takeoff_recorded',
      'flight.landing_recorded',
      'flight.completed',
      'pirep.created'
    )
      and (
        processing.id is null
        or (
          processing.status in ('FAILED', 'PENDING')
          and (
            processing.next_retry_at is null
            or processing.next_retry_at <= now()
          )
        )
      )
    order by events.occurred_at, events.created_at, events.id
    limit greatest(1, least(coalesce(p_limit, 100), 1000))
  loop
    event_id := v_record.id;
    v_status := public.process_operations_event_reliably(v_record.id);
    processed := v_status = 'PROCESSED';
    return next;
  end loop;
end;
$$;

revoke all on function public.retry_operations_projection(integer)
from public, anon, authenticated;
grant execute on function public.retry_operations_projection(integer)
to service_role;

create or replace function public.requeue_dead_letter(
  p_dead_letter_id uuid
)
returns public."EventProcessingStatus"
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dead public.event_dead_letters%rowtype;
  v_status public."EventProcessingStatus";
begin
  select *
  into v_dead
  from public.event_dead_letters
  where id = p_dead_letter_id
  for update;

  if not found then
    raise exception 'Dead-letter record not found';
  end if;

  update public.event_processing_log
  set
    status = 'FAILED',
    attempts = 0,
    next_retry_at = now(),
    dead_lettered_at = null,
    last_error = null,
    updated_at = now()
  where event_id = v_dead.event_id
    and consumer_name = v_dead.consumer_name;

  update public.event_dead_letters
  set
    resolved_at = now(),
    resolution = 'manually_requeued',
    updated_at = now()
  where id = p_dead_letter_id;

  v_status := public.process_operations_event_reliably(v_dead.event_id);
  return v_status;
end;
$$;

revoke all on function public.requeue_dead_letter(uuid)
from public, anon, authenticated;
grant execute on function public.requeue_dead_letter(uuid)
to service_role;

create or replace view public.event_platform_health as
select
  count(*)::bigint as total_events,
  count(*) filter (where p.status = 'PROCESSED')::bigint as processed_events,
  count(*) filter (where p.status = 'FAILED')::bigint as failed_events,
  count(*) filter (
    where p.status in ('PENDING', 'PROCESSING')
  )::bigint as pending_events,
  count(*) filter (where p.status = 'DEAD_LETTER')::bigint
    as dead_letter_events,
  min(e.occurred_at) filter (
    where p.status in ('FAILED', 'PENDING', 'PROCESSING')
  ) as oldest_unhealthy_event_at,
  case
    when count(*) filter (where p.status = 'DEAD_LETTER') > 0
      then 'critical'
    when count(*) filter (
      where p.status in ('FAILED', 'PENDING', 'PROCESSING')
    ) > 0
      then 'degraded'
    else 'healthy'
  end as health_status
from public.platform_events e
left join public.event_processing_log p
  on p.event_id = e.id
 and p.consumer_name = 'operations.projector';

revoke all on public.event_platform_health from public, anon, authenticated;
grant select on public.event_platform_health to service_role;

-- ===========================================================================
-- AIRCRAFT STATE SYNC
-- ===========================================================================

create table if not exists public.aircraft_operational_state (
  aircraft_id uuid primary key
    references public.aircraft(id) on delete cascade,
  operational_status text not null default 'available' check (
    operational_status in (
      'available',
      'reserved',
      'boarding',
      'taxi',
      'enroute',
      'landed'
    )
  ),
  active_booking_id uuid
    references public.flight_bookings(id) on delete set null,
  last_booking_id uuid
    references public.flight_bookings(id) on delete set null,
  pilot_id uuid
    references public.profiles(id) on delete set null,
  route_id uuid
    references public.routes(id) on delete set null,
  current_airport_id uuid
    references public.airports(id) on delete set null,
  destination_airport_id uuid
    references public.airports(id) on delete set null,
  last_event_id uuid not null
    references public.platform_events(id) on delete restrict,
  last_event_type text not null,
  last_event_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_aircraft_operational_state_status
on public.aircraft_operational_state(operational_status);

alter table public.aircraft_operational_state enable row level security;

drop policy if exists aircraft_operational_state_select_authenticated
on public.aircraft_operational_state;

create policy aircraft_operational_state_select_authenticated
on public.aircraft_operational_state for select
to authenticated
using (true);

create or replace function public.sync_aircraft_state_from_event(
  p_event_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.platform_events%rowtype;
  v_booking public.flight_bookings%rowtype;
  v_route public.routes%rowtype;
  v_booking_id uuid;
  v_aircraft_id uuid;
  v_state text;
begin
  select * into v_event
  from public.platform_events
  where id = p_event_id;

  if not found or v_event.event_type not in (
    'flight.booked',
    'aircraft.assigned',
    'dispatch.created',
    'flight.boarding_started',
    'flight.pushback_started',
    'flight.takeoff_recorded',
    'flight.landing_recorded',
    'flight.completed'
  ) then
    return false;
  end if;

  v_booking_id := nullif(v_event.payload ->> 'bookingId', '')::uuid;
  if v_booking_id is null then return false; end if;

  select * into v_booking
  from public.flight_bookings
  where id = v_booking_id;

  if not found then return false; end if;

  select * into v_route
  from public.routes
  where id = v_booking.route_id;

  if not found then return false; end if;

  v_aircraft_id := coalesce(
    nullif(v_event.payload ->> 'aircraftId', '')::uuid,
    v_booking.aircraft_id
  );

  if v_aircraft_id is null then return false; end if;

  v_state := case v_event.event_type
    when 'flight.booked' then 'reserved'
    when 'aircraft.assigned' then 'reserved'
    when 'dispatch.created' then 'reserved'
    when 'flight.boarding_started' then 'boarding'
    when 'flight.pushback_started' then 'taxi'
    when 'flight.takeoff_recorded' then 'enroute'
    when 'flight.landing_recorded' then 'landed'
    when 'flight.completed' then 'available'
    else 'available'
  end;

  insert into public.aircraft_operational_state (
    aircraft_id,
    operational_status,
    active_booking_id,
    last_booking_id,
    pilot_id,
    route_id,
    current_airport_id,
    destination_airport_id,
    last_event_id,
    last_event_type,
    last_event_at,
    updated_at
  )
  values (
    v_aircraft_id,
    v_state,
    case when v_state = 'available' then null else v_booking.id end,
    v_booking.id,
    case when v_state = 'available' then null else v_booking.pilot_id end,
    case when v_state = 'available' then null else v_booking.route_id end,
    case
      when v_state = 'available' then v_route.arrival_airport_id
      else v_route.departure_airport_id
    end,
    case
      when v_state = 'available' then null
      else v_route.arrival_airport_id
    end,
    v_event.id,
    v_event.event_type,
    v_event.occurred_at,
    now()
  )
  on conflict (aircraft_id)
  do update set
    operational_status = excluded.operational_status,
    active_booking_id = excluded.active_booking_id,
    last_booking_id = excluded.last_booking_id,
    pilot_id = excluded.pilot_id,
    route_id = excluded.route_id,
    current_airport_id = excluded.current_airport_id,
    destination_airport_id = excluded.destination_airport_id,
    last_event_id = excluded.last_event_id,
    last_event_type = excluded.last_event_type,
    last_event_at = excluded.last_event_at,
    updated_at = now();

  if v_event.event_type = 'flight.completed' then
    update public.aircraft
    set
      current_airport_id = v_route.arrival_airport_id,
      status = 'active'
    where id = v_aircraft_id;
  end if;

  return true;
end;
$$;

revoke all on function public.sync_aircraft_state_from_event(uuid)
from public, anon, authenticated;
grant execute on function public.sync_aircraft_state_from_event(uuid)
to service_role;

-- ===========================================================================
-- AUTO PIREP
-- ===========================================================================

create table if not exists public.auto_pirep_drafts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique
    references public.flight_bookings(id) on delete cascade,
  pilot_id uuid not null
    references public.profiles(id) on delete cascade,
  route_id uuid not null
    references public.routes(id) on delete restrict,
  aircraft_id uuid
    references public.aircraft(id) on delete set null,
  flight_number text not null,
  departure_airport_id uuid not null
    references public.airports(id) on delete restrict,
  arrival_airport_id uuid not null
    references public.airports(id) on delete restrict,
  suggested_block_minutes integer not null check (
    suggested_block_minutes > 0
  ),
  status text not null default 'ready' check (
    status in ('ready', 'submitted', 'dismissed')
  ),
  created_from_event_id uuid not null unique
    references public.platform_events(id) on delete restrict,
  submitted_pirep_id uuid
    references public.pireps(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_auto_pirep_drafts_pilot_status
on public.auto_pirep_drafts(pilot_id, status, created_at desc);

alter table public.auto_pirep_drafts enable row level security;

drop policy if exists auto_pirep_drafts_select_own
on public.auto_pirep_drafts;

create policy auto_pirep_drafts_select_own
on public.auto_pirep_drafts for select
to authenticated
using (pilot_id = auth.uid());

create or replace function public.create_auto_pirep_draft_from_event(
  p_event_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.platform_events%rowtype;
  v_booking public.flight_bookings%rowtype;
  v_route public.routes%rowtype;
  v_booking_id uuid;
  v_minutes integer;
  v_draft_id uuid;
begin
  select * into v_event
  from public.platform_events
  where id = p_event_id
    and event_type = 'flight.completed';

  if not found then return null; end if;

  v_booking_id := nullif(v_event.payload ->> 'bookingId', '')::uuid;
  if v_booking_id is null then return null; end if;

  if exists (
    select 1 from public.pireps where booking_id = v_booking_id
  ) then
    return null;
  end if;

  select * into v_booking
  from public.flight_bookings
  where id = v_booking_id;

  if not found then return null; end if;

  select * into v_route
  from public.routes
  where id = v_booking.route_id;

  if not found then return null; end if;

  v_minutes := greatest(
    1,
    coalesce(
      case
        when v_booking.started_at is not null
         and v_booking.completed_at is not null
        then round(
          extract(epoch from (
            v_booking.completed_at - v_booking.started_at
          )) / 60.0
        )::integer
        else null
      end,
      v_route.scheduled_minutes,
      1
    )
  );

  insert into public.auto_pirep_drafts (
    booking_id,
    pilot_id,
    route_id,
    aircraft_id,
    flight_number,
    departure_airport_id,
    arrival_airport_id,
    suggested_block_minutes,
    status,
    created_from_event_id,
    updated_at
  )
  values (
    v_booking.id,
    v_booking.pilot_id,
    v_booking.route_id,
    v_booking.aircraft_id,
    v_route.flight_number,
    v_route.departure_airport_id,
    v_route.arrival_airport_id,
    v_minutes,
    'ready',
    v_event.id,
    now()
  )
  on conflict (booking_id)
  do update set
    suggested_block_minutes = excluded.suggested_block_minutes,
    updated_at = now()
  returning id into v_draft_id;

  if not exists (
    select 1
    from public.platform_events
    where event_type = 'pirep.draft_created'
      and payload ->> 'draftId' = v_draft_id::text
  ) then
    perform public.append_domain_event(
      p_event_type => 'pirep.draft_created',
      p_aggregate_type => 'pirep_draft',
      p_aggregate_id => v_draft_id::text,
      p_actor_id => v_booking.pilot_id::text,
      p_correlation_id => v_event.correlation_id,
      p_causation_id => v_event.id,
      p_payload => jsonb_build_object(
        'draftId', v_draft_id,
        'bookingId', v_booking.id,
        'pilotId', v_booking.pilot_id,
        'aircraftId', v_booking.aircraft_id,
        'flightNumber', v_route.flight_number,
        'suggestedBlockMinutes', v_minutes,
        'status', 'ready'
      ),
      p_metadata => jsonb_build_object(
        'source', 'core.auto_pirep',
        'privacy', 'restricted'
      )
    );
  end if;

  return v_draft_id;
end;
$$;

revoke all on function public.create_auto_pirep_draft_from_event(uuid)
from public, anon, authenticated;
grant execute on function public.create_auto_pirep_draft_from_event(uuid)
to service_role;

create or replace function public.mark_auto_pirep_draft_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.booking_id is not null then
    update public.auto_pirep_drafts
    set
      status = 'submitted',
      submitted_pirep_id = new.id,
      updated_at = now()
    where booking_id = new.booking_id;
  end if;

  return new;
end;
$$;

drop trigger if exists after_pirep_mark_auto_draft_submitted
on public.pireps;

create trigger after_pirep_mark_auto_draft_submitted
after insert on public.pireps
for each row
execute function public.mark_auto_pirep_draft_submitted();

-- ===========================================================================
-- UNIFIED CORE EVENT TRIGGER
-- ===========================================================================

create or replace function public.handle_kva_core_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.event_type in (
    'flight.booked',
    'aircraft.assigned',
    'dispatch.created',
    'flight.boarding_started',
    'flight.pushback_started',
    'flight.takeoff_recorded',
    'flight.landing_recorded',
    'flight.completed',
    'pirep.created'
  ) then
    perform public.process_operations_event_reliably(new.id);
  end if;

  if new.event_type in (
    'flight.booked',
    'aircraft.assigned',
    'dispatch.created',
    'flight.boarding_started',
    'flight.pushback_started',
    'flight.takeoff_recorded',
    'flight.landing_recorded',
    'flight.completed'
  ) then
    perform public.sync_aircraft_state_from_event(new.id);
  end if;

  if new.event_type = 'flight.completed' then
    perform public.create_auto_pirep_draft_from_event(new.id);
  end if;

  return new;
end;
$$;

revoke all on function public.handle_kva_core_event_insert()
from public, anon, authenticated;

drop trigger if exists after_platform_event_operations_projection
on public.platform_events;

drop trigger if exists after_platform_event_kva_core
on public.platform_events;

create trigger after_platform_event_kva_core
after insert on public.platform_events
for each row
execute function public.handle_kva_core_event_insert();

-- Extend the existing console audit action constraint.
alter table public.operations_console_audit
  drop constraint if exists operations_console_audit_action_check;

alter table public.operations_console_audit
  add constraint operations_console_audit_action_check
  check (
    action in (
      'retry_single_event',
      'retry_failed_events',
      'rebuild_projection',
      'retry_due_events',
      'requeue_dead_letter'
    )
  );

-- Backfill state and drafts from existing event history.
do $$
declare
  v_record record;
begin
  for v_record in
    select id, event_type
    from public.platform_events
    where event_type in (
      'flight.booked',
      'aircraft.assigned',
      'dispatch.created',
      'flight.boarding_started',
      'flight.pushback_started',
      'flight.takeoff_recorded',
      'flight.landing_recorded',
      'flight.completed'
    )
    order by occurred_at, created_at, id
  loop
    perform public.sync_aircraft_state_from_event(v_record.id);

    if v_record.event_type = 'flight.completed' then
      perform public.create_auto_pirep_draft_from_event(v_record.id);
    end if;
  end loop;
end
$$;
