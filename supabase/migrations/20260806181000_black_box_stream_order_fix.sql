-- KVA Black Box Replay Stream Order Fix v1.2
-- Adds a durable insertion position so events created inside one transaction
-- can be replayed in their true order.

create sequence if not exists public.platform_event_stream_position_seq;

alter table public.platform_events
  add column if not exists stream_position bigint;

with ordered_events as (
  select
    event.id,
    row_number() over (
      order by
        event.occurred_at,
        event.created_at,
        case event.event_type
          when 'flight.booked' then 10
          when 'aircraft.assigned' then 20
          when 'dispatch.created' then 30
          when 'flight.boarding_started' then 40
          when 'flight.pushback_started' then 50
          when 'flight.takeoff_recorded' then 60
          when 'flight.landing_recorded' then 70
          when 'flight.completed' then 80
          when 'pirep.draft_created' then 90
          when 'pirep.created' then 100
          else 1000
        end,
        event.id
    )::bigint as stream_position
  from public.platform_events event
)
update public.platform_events event
set stream_position = ordered.stream_position
from ordered_events ordered
where event.id = ordered.id
  and event.stream_position is null;

select setval(
  'public.platform_event_stream_position_seq',
  greatest(
    coalesce(
      (select max(stream_position) from public.platform_events),
      0
    ) + 1,
    1
  ),
  false
);

alter sequence public.platform_event_stream_position_seq
  owned by public.platform_events.stream_position;

alter table public.platform_events
  alter column stream_position
  set default nextval('public.platform_event_stream_position_seq');

alter table public.platform_events
  alter column stream_position set not null;

create unique index if not exists uq_platform_events_stream_position
on public.platform_events(stream_position);

create index if not exists idx_platform_events_booking_stream_position
on public.platform_events(
  ((payload ->> 'bookingId')),
  stream_position
);

create or replace function public.normalize_flight_event_lineage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
  v_previous_event_id uuid;
  v_root_correlation_id uuid;
begin
  if new.event_type not in (
    'flight.booked',
    'aircraft.assigned',
    'dispatch.created',
    'flight.boarding_started',
    'flight.pushback_started',
    'flight.takeoff_recorded',
    'flight.landing_recorded',
    'flight.completed',
    'pirep.draft_created',
    'pirep.created'
  ) then
    return new;
  end if;

  begin
    v_booking_id := nullif(new.payload ->> 'bookingId', '')::uuid;
  exception
    when invalid_text_representation then
      return new;
  end;

  if v_booking_id is null and new.aggregate_type = 'flight' then
    begin
      v_booking_id := nullif(new.aggregate_id, '')::uuid;
    exception
      when invalid_text_representation then
        return new;
    end;
  end if;

  if v_booking_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(v_booking_id::text));

  if new.event_type = 'flight.booked' then
    new.causation_id := null;
    return new;
  end if;

  select event.correlation_id
  into v_root_correlation_id
  from public.platform_events event
  where (
    event.payload ->> 'bookingId' = v_booking_id::text
    or (
      event.aggregate_type = 'flight'
      and event.aggregate_id = v_booking_id::text
    )
  )
    and event.event_type = 'flight.booked'
  order by event.stream_position
  limit 1;

  select event.id
  into v_previous_event_id
  from public.platform_events event
  where (
    event.payload ->> 'bookingId' = v_booking_id::text
    or (
      event.aggregate_type = 'flight'
      and event.aggregate_id = v_booking_id::text
    )
  )
    and event.event_type in (
      'flight.booked',
      'aircraft.assigned',
      'dispatch.created',
      'flight.boarding_started',
      'flight.pushback_started',
      'flight.takeoff_recorded',
      'flight.landing_recorded',
      'flight.completed',
      'pirep.draft_created',
      'pirep.created'
    )
  order by event.stream_position desc
  limit 1;

  if v_root_correlation_id is not null then
    new.correlation_id := v_root_correlation_id;
  end if;

  if v_previous_event_id is not null then
    new.causation_id := v_previous_event_id;
  end if;

  return new;
end;
$$;

revoke all on function public.normalize_flight_event_lineage()
from public, anon, authenticated;

drop trigger if exists before_platform_event_normalize_flight_lineage
on public.platform_events;

create trigger before_platform_event_normalize_flight_lineage
before insert on public.platform_events
for each row
execute function public.normalize_flight_event_lineage();

create or replace view public.black_box_replay_index
as
select
  projection.booking_id,
  coalesce(projection.organization_id, 'kalabsha-airlines')
    as organization_id,
  projection.flight_number,
  projection.status,
  projection.pilot_id,
  projection.aircraft_id,
  projection.dispatch_id,
  projection.pirep_id,
  projection.started_at,
  projection.completed_at,
  projection.last_event_id,
  projection.last_event_type,
  projection.last_event_at,
  projection.projection_version,
  coalesce(event_stats.event_count, 0)::integer as event_count,
  coalesce(event_stats.unhealthy_event_count, 0)::integer
    as unhealthy_event_count,
  event_stats.first_event_at,
  event_stats.latest_source_event_at
from public.operations_flight_projection projection
left join lateral (
  select
    count(*)::integer as event_count,
    count(*) filter (
      where processing.status in (
        'FAILED',
        'PENDING',
        'PROCESSING',
        'DEAD_LETTER'
      )
    )::integer as unhealthy_event_count,
    min(event.occurred_at) as first_event_at,
    max(event.occurred_at) as latest_source_event_at
  from public.platform_events event
  left join public.event_processing_log processing
    on processing.event_id = event.id
   and processing.consumer_name = 'operations.projector'
  where (
    event.payload ->> 'bookingId' = projection.booking_id::text
    or (
      event.aggregate_type = 'flight'
      and event.aggregate_id = projection.booking_id::text
    )
  )
    and event.event_type in (
      'flight.booked',
      'aircraft.assigned',
      'dispatch.created',
      'flight.boarding_started',
      'flight.pushback_started',
      'flight.takeoff_recorded',
      'flight.landing_recorded',
      'flight.completed',
      'pirep.draft_created',
      'pirep.created'
    )
) event_stats on true;

revoke all on public.black_box_replay_index
from public, anon, authenticated;

grant select on public.black_box_replay_index
to service_role;


create or replace function public.get_flight_black_box_replay(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_projection public.operations_flight_projection%rowtype;
  v_events jsonb := '[]'::jsonb;
  v_notes jsonb := '[]'::jsonb;
  v_event_count integer := 0;
  v_unhealthy_count integer := 0;
  v_unresolved_causation integer := 0;
  v_missing_causation integer := 0;
  v_unexpected_causation integer := 0;
  v_correlation_count integer := 0;
  v_has_origin boolean := false;
  v_projection_last_event_present boolean := false;
  v_replayed_status text := 'unknown';
  v_status_matches boolean := false;
begin
  select *
  into v_projection
  from public.operations_flight_projection
  where booking_id = p_booking_id;

  if not found then
    return null;
  end if;

  with replay_events as (
    select event.*
    from public.platform_events event
    where (
      event.payload ->> 'bookingId' = p_booking_id::text
      or (
        event.aggregate_type = 'flight'
        and event.aggregate_id = p_booking_id::text
      )
    )
      and event.event_type in (
        'flight.booked',
        'aircraft.assigned',
        'dispatch.created',
        'flight.boarding_started',
        'flight.pushback_started',
        'flight.takeoff_recorded',
        'flight.landing_recorded',
        'flight.completed',
        'pirep.draft_created',
        'pirep.created'
      )
    order by event.stream_position
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', event.id,
        'streamPosition', event.stream_position,
        'eventType', event.event_type,
        'eventVersion', event.event_version,
        'organizationId', event.organization_id,
        'aggregateType', event.aggregate_type,
        'aggregateId', event.aggregate_id,
        'actorId', event.actor_id,
        'correlationId', event.correlation_id,
        'causationId', event.causation_id,
        'occurredAt', event.occurred_at,
        'payload', event.payload,
        'metadata', event.metadata,
        'createdAt', event.created_at,
        'processing', (
          select jsonb_build_object(
            'consumerName', processing.consumer_name,
            'status', processing.status,
            'attempts', processing.attempts,
            'lastError', processing.last_error,
            'processedAt', processing.processed_at,
            'updatedAt', processing.updated_at
          )
          from public.event_processing_log processing
          where processing.event_id = event.id
            and processing.consumer_name = 'operations.projector'
          limit 1
        )
      )
      order by event.stream_position
    ),
    '[]'::jsonb
  )
  into v_events
  from replay_events event;

  with ordered_events as (
    select
      event.*,
      row_number() over (
        order by event.stream_position
      ) as sequence_number,
      lag(event.id) over (
        order by event.stream_position
      ) as expected_causation_id
    from public.platform_events event
    where (
      event.payload ->> 'bookingId' = p_booking_id::text
      or (
        event.aggregate_type = 'flight'
        and event.aggregate_id = p_booking_id::text
      )
    )
      and event.event_type in (
        'flight.booked',
        'aircraft.assigned',
        'dispatch.created',
        'flight.boarding_started',
        'flight.pushback_started',
        'flight.takeoff_recorded',
        'flight.landing_recorded',
        'flight.completed',
        'pirep.draft_created',
        'pirep.created'
      )
  )
  select
    count(*)::integer,
    count(*) filter (
      where processing.status in (
        'FAILED',
        'PENDING',
        'PROCESSING',
        'DEAD_LETTER'
      )
    )::integer,
    count(*) filter (
      where ordered.causation_id is not null
        and not exists (
          select 1
          from public.platform_events cause
          where cause.id = ordered.causation_id
        )
    )::integer,
    count(*) filter (
      where ordered.sequence_number > 1
        and ordered.causation_id is null
    )::integer,
    count(*) filter (
      where ordered.sequence_number > 1
        and ordered.causation_id is not null
        and ordered.causation_id is distinct from
          ordered.expected_causation_id
    )::integer,
    count(distinct ordered.correlation_id)::integer,
    bool_or(
      ordered.sequence_number = 1
      and ordered.event_type = 'flight.booked'
      and ordered.causation_id is null
    ),
    bool_or(ordered.id = v_projection.last_event_id)
  into
    v_event_count,
    v_unhealthy_count,
    v_unresolved_causation,
    v_missing_causation,
    v_unexpected_causation,
    v_correlation_count,
    v_has_origin,
    v_projection_last_event_present
  from ordered_events ordered
  left join public.event_processing_log processing
    on processing.event_id = ordered.id
   and processing.consumer_name = 'operations.projector';

  select coalesce(
    (
      select case event.event_type
        when 'flight.booked' then 'booked'
        when 'flight.boarding_started' then 'boarding'
        when 'flight.pushback_started' then 'departed'
        when 'flight.takeoff_recorded' then 'enroute'
        when 'flight.landing_recorded' then 'landed'
        when 'flight.completed' then 'completed'
        else 'unknown'
      end
      from public.platform_events event
      where (
        event.payload ->> 'bookingId' = p_booking_id::text
        or (
          event.aggregate_type = 'flight'
          and event.aggregate_id = p_booking_id::text
        )
      )
        and event.event_type in (
          'flight.booked',
          'flight.boarding_started',
          'flight.pushback_started',
          'flight.takeoff_recorded',
          'flight.landing_recorded',
          'flight.completed'
        )
      order by event.stream_position desc
      limit 1
    ),
    'unknown'
  )
  into v_replayed_status;

  v_status_matches := v_replayed_status = v_projection.status;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', note.id,
        'authorUserId', note.author_user_id,
        'authorEmail', note.author_email,
        'note', note.note,
        'createdAt', note.created_at
      )
      order by note.created_at desc, note.id desc
    ),
    '[]'::jsonb
  )
  into v_notes
  from public.black_box_replay_notes note
  where note.booking_id = p_booking_id;

  return jsonb_build_object(
    'generatedAt', now(),
    'bookingId', v_projection.booking_id,
    'organizationId', coalesce(
      v_projection.organization_id,
      'kalabsha-airlines'
    ),
    'projection', jsonb_build_object(
      'flightNumber', v_projection.flight_number,
      'status', v_projection.status,
      'pilotId', v_projection.pilot_id,
      'aircraftId', v_projection.aircraft_id,
      'dispatchId', v_projection.dispatch_id,
      'pirepId', v_projection.pirep_id,
      'startedAt', v_projection.started_at,
      'completedAt', v_projection.completed_at,
      'lastEventId', v_projection.last_event_id,
      'lastEventType', v_projection.last_event_type,
      'lastEventAt', v_projection.last_event_at,
      'projectionVersion', v_projection.projection_version
    ),
    'integrity', jsonb_build_object(
      'eventCount', v_event_count,
      'unhealthyProcessingCount', v_unhealthy_count,
      'unresolvedCausationLinks', v_unresolved_causation,
      'missingCausationLinks', v_missing_causation,
      'unexpectedCausationLinks', v_unexpected_causation,
      'correlationCount', v_correlation_count,
      'singleCorrelation', v_correlation_count = 1,
      'hasOriginEvent', coalesce(v_has_origin, false),
      'projectionLastEventPresent',
        coalesce(v_projection_last_event_present, false),
      'replayedStatus', v_replayed_status,
      'projectionStatus', v_projection.status,
      'statusMatchesProjection', v_status_matches,
      'healthy',
        coalesce(v_has_origin, false)
        and coalesce(v_projection_last_event_present, false)
        and v_unhealthy_count = 0
        and v_unresolved_causation = 0
        and v_missing_causation = 0
        and v_unexpected_causation = 0
        and v_correlation_count = 1
        and v_status_matches
    ),
    'events', v_events,
    'notes', v_notes
  );
end;
$$;

revoke all on function public.get_flight_black_box_replay(uuid)
from public, anon, authenticated;

grant execute on function public.get_flight_black_box_replay(uuid)
to service_role;
