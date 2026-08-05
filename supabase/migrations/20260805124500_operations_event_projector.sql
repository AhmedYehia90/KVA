-- KVA Operations Event Projector v1.0
-- Builds an idempotent operational read model from the durable event stream.

create table if not exists public.operations_flight_projection (
  booking_id uuid primary key
    references public.flight_bookings(id) on delete cascade,
  organization_id text,
  route_id uuid
    references public.routes(id) on delete restrict,
  flight_number text,
  pilot_id uuid
    references public.profiles(id) on delete set null,
  aircraft_id uuid
    references public.aircraft(id) on delete set null,
  dispatch_id uuid
    references public.dispatches(id) on delete set null,
  pirep_id uuid
    references public.pireps(id) on delete set null,
  status text not null default 'booked' check (
    status in (
      'booked',
      'boarding',
      'departed',
      'enroute',
      'landed',
      'completed',
      'cancelled',
      'expired'
    )
  ),
  started_at timestamptz,
  completed_at timestamptz,
  last_event_id uuid not null
    references public.platform_events(id) on delete restrict,
  last_event_type text not null,
  last_event_at timestamptz not null,
  projection_version integer not null default 1 check (projection_version > 0),
  projected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_operations_projection_last_event
on public.operations_flight_projection(last_event_id);

create index if not exists idx_operations_projection_status_event_at
on public.operations_flight_projection(status, last_event_at desc);

create index if not exists idx_operations_projection_aircraft
on public.operations_flight_projection(aircraft_id);

create index if not exists idx_operations_projection_pilot
on public.operations_flight_projection(pilot_id);

alter table public.operations_flight_projection enable row level security;

drop policy if exists operations_projection_select_authenticated
on public.operations_flight_projection;

create policy operations_projection_select_authenticated
on public.operations_flight_projection
for select
to authenticated
using (true);

create or replace function public.project_operations_event(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.platform_events%rowtype;
  v_existing_status public."EventProcessingStatus";
  v_booking_id uuid;
  v_status text;
begin
  perform pg_advisory_xact_lock(hashtext(p_event_id::text));

  select *
  into v_event
  from public.platform_events
  where id = p_event_id;

  if not found then
    return false;
  end if;

  if v_event.event_type not in (
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
    return false;
  end if;

  v_booking_id := nullif(v_event.payload ->> 'bookingId', '')::uuid;
  if v_booking_id is null then
    return false;
  end if;

  select status
  into v_existing_status
  from public.event_processing_log
  where event_id = v_event.id
    and consumer_name = 'operations.projector';

  if v_existing_status = 'PROCESSED' then
    return false;
  end if;

  insert into public.event_processing_log (
    event_id,
    consumer_name,
    status,
    attempts,
    last_error,
    processed_at,
    updated_at
  )
  values (
    v_event.id,
    'operations.projector',
    'PROCESSING',
    1,
    null,
    null,
    now()
  )
  on conflict (event_id, consumer_name)
  do update set
    status = 'PROCESSING',
    attempts = public.event_processing_log.attempts + 1,
    last_error = null,
    processed_at = null,
    updated_at = now();

  begin
    v_status := coalesce(
      nullif(v_event.payload ->> 'status', ''),
      case v_event.event_type
        when 'flight.booked' then 'booked'
        when 'flight.boarding_started' then 'boarding'
        when 'flight.pushback_started' then 'departed'
        when 'flight.takeoff_recorded' then 'enroute'
        when 'flight.landing_recorded' then 'landed'
        when 'flight.completed' then 'completed'
        else null
      end
    );

    if v_event.event_type = 'flight.booked' then
      insert into public.operations_flight_projection (
        booking_id,
        organization_id,
        route_id,
        flight_number,
        pilot_id,
        aircraft_id,
        status,
        started_at,
        completed_at,
        last_event_id,
        last_event_type,
        last_event_at,
        projection_version,
        projected_at,
        updated_at
      )
      values (
        v_booking_id,
        v_event.organization_id,
        nullif(v_event.payload ->> 'routeId', '')::uuid,
        nullif(v_event.payload ->> 'flightNumber', ''),
        nullif(v_event.payload ->> 'pilotId', '')::uuid,
        nullif(v_event.payload ->> 'aircraftId', '')::uuid,
        coalesce(v_status, 'booked'),
        null,
        null,
        v_event.id,
        v_event.event_type,
        v_event.occurred_at,
        1,
        now(),
        now()
      )
      on conflict (booking_id)
      do update set
        organization_id = excluded.organization_id,
        route_id = excluded.route_id,
        flight_number = excluded.flight_number,
        pilot_id = excluded.pilot_id,
        aircraft_id = coalesce(
          excluded.aircraft_id,
          public.operations_flight_projection.aircraft_id
        ),
        status = excluded.status,
        last_event_id = excluded.last_event_id,
        last_event_type = excluded.last_event_type,
        last_event_at = excluded.last_event_at,
        projection_version =
          public.operations_flight_projection.projection_version + 1,
        projected_at = now(),
        updated_at = now();

    elsif v_event.event_type = 'aircraft.assigned' then
      update public.operations_flight_projection
      set
        aircraft_id = nullif(v_event.payload ->> 'aircraftId', '')::uuid,
        last_event_id = v_event.id,
        last_event_type = v_event.event_type,
        last_event_at = v_event.occurred_at,
        projection_version = projection_version + 1,
        projected_at = now(),
        updated_at = now()
      where booking_id = v_booking_id;

    elsif v_event.event_type = 'dispatch.created' then
      update public.operations_flight_projection
      set
        dispatch_id = nullif(v_event.payload ->> 'dispatchId', '')::uuid,
        last_event_id = v_event.id,
        last_event_type = v_event.event_type,
        last_event_at = v_event.occurred_at,
        projection_version = projection_version + 1,
        projected_at = now(),
        updated_at = now()
      where booking_id = v_booking_id;

    elsif v_event.event_type = 'pirep.created' then
      update public.operations_flight_projection
      set
        pirep_id = nullif(v_event.payload ->> 'pirepId', '')::uuid,
        last_event_id = v_event.id,
        last_event_type = v_event.event_type,
        last_event_at = v_event.occurred_at,
        projection_version = projection_version + 1,
        projected_at = now(),
        updated_at = now()
      where booking_id = v_booking_id;

    else
      update public.operations_flight_projection
      set
        status = coalesce(v_status, status),
        started_at = case
          when v_event.event_type = 'flight.boarding_started'
            then coalesce(started_at, v_event.occurred_at)
          else started_at
        end,
        completed_at = case
          when v_event.event_type = 'flight.completed'
            then coalesce(completed_at, v_event.occurred_at)
          else completed_at
        end,
        aircraft_id = coalesce(
          nullif(v_event.payload ->> 'aircraftId', '')::uuid,
          aircraft_id
        ),
        last_event_id = v_event.id,
        last_event_type = v_event.event_type,
        last_event_at = v_event.occurred_at,
        projection_version = projection_version + 1,
        projected_at = now(),
        updated_at = now()
      where booking_id = v_booking_id;
    end if;

    if not found then
      raise exception
        'Operations projection missing for booking % while processing %',
        v_booking_id,
        v_event.event_type;
    end if;

    update public.event_processing_log
    set
      status = 'PROCESSED',
      processed_at = now(),
      last_error = null,
      updated_at = now()
    where event_id = v_event.id
      and consumer_name = 'operations.projector';

    return true;
  exception
    when others then
      update public.event_processing_log
      set
        status = 'FAILED',
        last_error = sqlerrm,
        processed_at = null,
        updated_at = now()
      where event_id = v_event.id
        and consumer_name = 'operations.projector';

      return false;
  end;
end;
$$;

revoke all on function public.project_operations_event(uuid)
from public, anon, authenticated;

grant execute on function public.project_operations_event(uuid)
to service_role;

create or replace function public.handle_operations_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.project_operations_event(new.id);
  return new;
end;
$$;

revoke all on function public.handle_operations_event_insert()
from public, anon, authenticated;

drop trigger if exists after_platform_event_operations_projection
on public.platform_events;

create trigger after_platform_event_operations_projection
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
    'flight.completed',
    'pirep.created'
  )
)
execute function public.handle_operations_event_insert();

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
        or processing.status in ('FAILED', 'PENDING')
      )
    order by events.occurred_at, events.created_at, events.id
    limit greatest(1, least(coalesce(p_limit, 100), 1000))
  loop
    event_id := v_record.id;
    processed := public.project_operations_event(v_record.id);
    return next;
  end loop;
end;
$$;

revoke all on function public.retry_operations_projection(integer)
from public, anon, authenticated;

grant execute on function public.retry_operations_projection(integer)
to service_role;

create or replace function public.rebuild_operations_projection()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record record;
  v_count integer := 0;
begin
  delete from public.event_processing_log
  where consumer_name = 'operations.projector';

  delete from public.operations_flight_projection;

  for v_record in
    select id
    from public.platform_events
    where event_type in (
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
    order by occurred_at, created_at, id
  loop
    if public.project_operations_event(v_record.id) then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.rebuild_operations_projection()
from public, anon, authenticated;

grant execute on function public.rebuild_operations_projection()
to service_role;

-- Backfill existing events in chronological order.
do $$
declare
  v_record record;
begin
  for v_record in
    select id
    from public.platform_events
    where event_type in (
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
    order by occurred_at, created_at, id
  loop
    perform public.project_operations_event(v_record.id);
  end loop;
end
$$;
