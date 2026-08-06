-- KVA Black Box Replay Pack v1.0
-- Deterministic flight reconstruction from immutable domain events.

create table if not exists public.black_box_replay_access_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null
    references public.flight_bookings(id) on delete cascade,
  organization_id text not null
    references public.platform_organizations(id) on delete restrict,
  actor_user_id uuid
    references auth.users(id) on delete set null,
  actor_email text not null,
  action text not null check (
    action in ('opened', 'exported')
  ),
  event_count integer not null default 0 check (event_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_black_box_access_booking_created
on public.black_box_replay_access_log(booking_id, created_at desc);

create index if not exists idx_black_box_access_actor_created
on public.black_box_replay_access_log(actor_user_id, created_at desc);

alter table public.black_box_replay_access_log enable row level security;

create table if not exists public.black_box_replay_notes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null
    references public.flight_bookings(id) on delete cascade,
  organization_id text not null
    references public.platform_organizations(id) on delete restrict,
  author_user_id uuid
    references auth.users(id) on delete set null,
  author_email text not null,
  note text not null check (
    char_length(btrim(note)) between 1 and 2000
  ),
  created_at timestamptz not null default now()
);

create index if not exists idx_black_box_notes_booking_created
on public.black_box_replay_notes(booking_id, created_at desc);

alter table public.black_box_replay_notes enable row level security;

-- No direct client policies are created. Replay data is internal and is read
-- through the server-only Supabase secret client after administrator checks.

create or replace view public.black_box_replay_index
as
select
  projection.booking_id,
  coalesce(
    projection.organization_id,
    'kalabsha-airlines'
  ) as organization_id,
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
  where
    event.payload ->> 'bookingId' = projection.booking_id::text
    or (
      event.aggregate_type = 'flight'
      and event.aggregate_id = projection.booking_id::text
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
    where
      event.payload ->> 'bookingId' = p_booking_id::text
      or (
        event.aggregate_type = 'flight'
        and event.aggregate_id = p_booking_id::text
      )
    order by event.occurred_at, event.created_at, event.id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', event.id,
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
      order by event.occurred_at, event.created_at, event.id
    ),
    '[]'::jsonb
  )
  into v_events
  from replay_events event;

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
      where event.causation_id is not null
        and not exists (
          select 1
          from public.platform_events cause
          where cause.id = event.causation_id
        )
    )::integer,
    count(distinct event.correlation_id)::integer,
    bool_or(event.event_type = 'flight.booked'),
    bool_or(event.id = v_projection.last_event_id)
  into
    v_event_count,
    v_unhealthy_count,
    v_unresolved_causation,
    v_correlation_count,
    v_has_origin,
    v_projection_last_event_present
  from public.platform_events event
  left join public.event_processing_log processing
    on processing.event_id = event.id
   and processing.consumer_name = 'operations.projector'
  where
    event.payload ->> 'bookingId' = p_booking_id::text
    or (
      event.aggregate_type = 'flight'
      and event.aggregate_id = p_booking_id::text
    );

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
      order by event.occurred_at desc, event.created_at desc, event.id desc
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
      'correlationCount', v_correlation_count,
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

create or replace function public.record_black_box_replay_access(
  p_booking_id uuid,
  p_actor_user_id uuid,
  p_actor_email text,
  p_action text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id text;
  v_event_count integer;
  v_access_id uuid;
begin
  if p_action not in ('opened', 'exported') then
    raise exception 'Invalid Black Box Replay access action';
  end if;

  select
    coalesce(organization_id, 'kalabsha-airlines'),
    event_count
  into
    v_organization_id,
    v_event_count
  from public.black_box_replay_index
  where booking_id = p_booking_id;

  if not found then
    raise exception 'Flight replay not found';
  end if;

  insert into public.black_box_replay_access_log (
    booking_id,
    organization_id,
    actor_user_id,
    actor_email,
    action,
    event_count
  )
  values (
    p_booking_id,
    v_organization_id,
    p_actor_user_id,
    p_actor_email,
    p_action,
    v_event_count
  )
  returning id into v_access_id;

  return v_access_id;
end;
$$;

revoke all on function public.record_black_box_replay_access(
  uuid, uuid, text, text
) from public, anon, authenticated;

grant execute on function public.record_black_box_replay_access(
  uuid, uuid, text, text
) to service_role;

create or replace function public.add_black_box_replay_note(
  p_booking_id uuid,
  p_author_user_id uuid,
  p_author_email text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id text;
  v_note_id uuid;
begin
  if p_note is null
     or char_length(btrim(p_note)) < 1
     or char_length(btrim(p_note)) > 2000 then
    raise exception 'Replay note must contain between 1 and 2000 characters';
  end if;

  select coalesce(organization_id, 'kalabsha-airlines')
  into v_organization_id
  from public.operations_flight_projection
  where booking_id = p_booking_id;

  if not found then
    raise exception 'Flight replay not found';
  end if;

  insert into public.black_box_replay_notes (
    booking_id,
    organization_id,
    author_user_id,
    author_email,
    note
  )
  values (
    p_booking_id,
    v_organization_id,
    p_author_user_id,
    p_author_email,
    btrim(p_note)
  )
  returning id into v_note_id;

  perform public.append_domain_event(
    p_event_type => 'replay.note_added',
    p_aggregate_type => 'flight_replay',
    p_aggregate_id => p_booking_id::text,
    p_actor_id => p_author_user_id::text,
    p_organization_id => v_organization_id,
    p_payload => jsonb_build_object(
      'bookingId', p_booking_id,
      'noteId', v_note_id,
      'note', btrim(p_note),
      'authorEmail', p_author_email
    ),
    p_metadata => jsonb_build_object(
      'source', 'black-box-replay.console',
      'privacy', 'internal'
    )
  );

  return v_note_id;
end;
$$;

revoke all on function public.add_black_box_replay_note(
  uuid, uuid, text, text
) from public, anon, authenticated;

grant execute on function public.add_black_box_replay_note(
  uuid, uuid, text, text
) to service_role;

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
      'requeue_dead_letter',
      'run_smart_operations_ai',
      'acknowledge_operations_finding',
      'resolve_operations_finding',
      'reopen_operations_finding',
      'open_black_box_replay',
      'export_black_box_replay',
      'add_black_box_note'
    )
  );
