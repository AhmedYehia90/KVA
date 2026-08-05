-- KVA Smart Operations AI Pack v1.0
-- Explainable operational intelligence for airline management.

create table if not exists public.smart_operations_ai_policies (
  organization_id text not null
    references public.platform_organizations(id) on delete cascade,
  policy_key text not null,
  enabled boolean not null default true,
  severity text not null check (
    severity in ('low', 'medium', 'high', 'critical')
  ),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, policy_key)
);

create table if not exists public.smart_operations_ai_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null
    references public.platform_organizations(id) on delete cascade,
  trigger_type text not null default 'manual' check (
    trigger_type in ('manual', 'scheduled', 'event', 'backfill')
  ),
  requested_by uuid
    references public.profiles(id) on delete set null,
  status text not null default 'running' check (
    status in ('running', 'completed', 'failed')
  ),
  rules_evaluated integer not null default 0,
  findings_opened integer not null default 0,
  findings_refreshed integer not null default 0,
  findings_auto_resolved integer not null default 0,
  health_score integer check (
    health_score is null or health_score between 0 and 100
  ),
  summary jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_smart_operations_runs_org_started
on public.smart_operations_ai_runs(organization_id, started_at desc);

create table if not exists public.smart_operations_ai_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null
    references public.platform_organizations(id) on delete cascade,
  fingerprint text not null,
  finding_type text not null check (
    finding_type in (
      'event_platform_degraded',
      'stalled_flight',
      'unassigned_aircraft',
      'completed_without_pirep',
      'pirep_review_delayed',
      'aircraft_state_missing'
    )
  ),
  severity text not null check (
    severity in ('low', 'medium', 'high', 'critical')
  ),
  status text not null default 'open' check (
    status in ('open', 'acknowledged', 'resolved')
  ),
  title text not null,
  summary text not null,
  recommendation text not null,
  subject_type text not null,
  subject_id text,
  confidence numeric(4,3) not null default 1 check (
    confidence >= 0 and confidence <= 1
  ),
  evidence jsonb not null default '{}'::jsonb,
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid
    references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid
    references public.profiles(id) on delete set null,
  resolution_note text,
  last_run_id uuid
    references public.smart_operations_ai_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, fingerprint)
);

create index if not exists idx_smart_operations_findings_open
on public.smart_operations_ai_findings(
  organization_id,
  status,
  severity,
  last_detected_at desc
);

alter table public.smart_operations_ai_policies enable row level security;
alter table public.smart_operations_ai_runs enable row level security;
alter table public.smart_operations_ai_findings enable row level security;

-- No client policies. The management console uses the server-only admin client.

drop trigger if exists smart_operations_policies_updated_at
on public.smart_operations_ai_policies;

create trigger smart_operations_policies_updated_at
before update on public.smart_operations_ai_policies
for each row
execute function public.set_updated_at();

drop trigger if exists smart_operations_findings_updated_at
on public.smart_operations_ai_findings;

create trigger smart_operations_findings_updated_at
before update on public.smart_operations_ai_findings
for each row
execute function public.set_updated_at();

insert into public.smart_operations_ai_policies (
  organization_id,
  policy_key,
  enabled,
  severity,
  configuration
)
values
  (
    'kalabsha-airlines',
    'event_platform_health',
    true,
    'high',
    '{}'::jsonb
  ),
  (
    'kalabsha-airlines',
    'stalled_flight',
    true,
    'medium',
    jsonb_build_object('threshold_hours', 6)
  ),
  (
    'kalabsha-airlines',
    'unassigned_aircraft',
    true,
    'high',
    '{}'::jsonb
  ),
  (
    'kalabsha-airlines',
    'completed_without_pirep',
    true,
    'medium',
    jsonb_build_object('threshold_hours', 2)
  ),
  (
    'kalabsha-airlines',
    'pirep_review_delayed',
    true,
    'medium',
    jsonb_build_object('threshold_hours', 24)
  ),
  (
    'kalabsha-airlines',
    'aircraft_state_missing',
    true,
    'high',
    '{}'::jsonb
  )
on conflict (organization_id, policy_key) do nothing;

create or replace function public.upsert_smart_operations_finding(
  p_run_id uuid,
  p_organization_id text,
  p_fingerprint text,
  p_finding_type text,
  p_severity text,
  p_title text,
  p_summary text,
  p_recommendation text,
  p_subject_type text,
  p_subject_id text,
  p_confidence numeric,
  p_evidence jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
begin
  select id
  into v_existing_id
  from public.smart_operations_ai_findings
  where organization_id = p_organization_id
    and fingerprint = p_fingerprint
  for update;

  if v_existing_id is null then
    insert into public.smart_operations_ai_findings (
      organization_id,
      fingerprint,
      finding_type,
      severity,
      status,
      title,
      summary,
      recommendation,
      subject_type,
      subject_id,
      confidence,
      evidence,
      first_detected_at,
      last_detected_at,
      last_run_id,
      updated_at
    )
    values (
      p_organization_id,
      p_fingerprint,
      p_finding_type,
      p_severity,
      'open',
      p_title,
      p_summary,
      p_recommendation,
      p_subject_type,
      p_subject_id,
      p_confidence,
      coalesce(p_evidence, '{}'::jsonb),
      now(),
      now(),
      p_run_id,
      now()
    );

    return true;
  end if;

  update public.smart_operations_ai_findings
  set
    finding_type = p_finding_type,
    severity = p_severity,
    status = case
      when status = 'resolved' then 'open'
      else status
    end,
    title = p_title,
    summary = p_summary,
    recommendation = p_recommendation,
    subject_type = p_subject_type,
    subject_id = p_subject_id,
    confidence = p_confidence,
    evidence = coalesce(p_evidence, '{}'::jsonb),
    last_detected_at = now(),
    resolved_at = case when status = 'resolved' then null else resolved_at end,
    resolved_by = case when status = 'resolved' then null else resolved_by end,
    resolution_note = case
      when status = 'resolved' then null
      else resolution_note
    end,
    last_run_id = p_run_id,
    updated_at = now()
  where id = v_existing_id;

  return false;
end;
$$;

revoke all on function public.upsert_smart_operations_finding(
  uuid, text, text, text, text, text, text, text, text, text, numeric, jsonb
) from public, anon, authenticated;

grant execute on function public.upsert_smart_operations_finding(
  uuid, text, text, text, text, text, text, text, text, text, numeric, jsonb
) to service_role;

create or replace function public.run_smart_operations_analysis(
  p_organization_id text default 'kalabsha-airlines',
  p_requested_by uuid default null,
  p_trigger_type text default 'manual'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_opened integer := 0;
  v_refreshed integer := 0;
  v_resolved integer := 0;
  v_rules integer := 0;
  v_created boolean;
  v_failed_events integer := 0;
  v_pending_events integer := 0;
  v_dead_letters integer := 0;
  v_stalled_hours integer := 6;
  v_missing_pirep_hours integer := 2;
  v_pirep_review_hours integer := 24;
  v_health_score integer := 100;
  v_record record;
begin
  if not exists (
    select 1
    from public.platform_organizations
    where id = p_organization_id
      and status = 'active'
  ) then
    raise exception 'Active organization not found: %', p_organization_id;
  end if;

  insert into public.smart_operations_ai_runs (
    organization_id,
    trigger_type,
    requested_by,
    status
  )
  values (
    p_organization_id,
    coalesce(p_trigger_type, 'manual'),
    p_requested_by,
    'running'
  )
  returning id into v_run_id;

  select coalesce(
    (
      select (configuration ->> 'threshold_hours')::integer
      from public.smart_operations_ai_policies
      where organization_id = p_organization_id
        and policy_key = 'stalled_flight'
        and enabled = true
    ),
    6
  )
  into v_stalled_hours;

  select coalesce(
    (
      select (configuration ->> 'threshold_hours')::integer
      from public.smart_operations_ai_policies
      where organization_id = p_organization_id
        and policy_key = 'completed_without_pirep'
        and enabled = true
    ),
    2
  )
  into v_missing_pirep_hours;

  select coalesce(
    (
      select (configuration ->> 'threshold_hours')::integer
      from public.smart_operations_ai_policies
      where organization_id = p_organization_id
        and policy_key = 'pirep_review_delayed'
        and enabled = true
    ),
    24
  )
  into v_pirep_review_hours;

  -- Rule 1: Event Platform reliability.
  if exists (
    select 1
    from public.smart_operations_ai_policies
    where organization_id = p_organization_id
      and policy_key = 'event_platform_health'
      and enabled = true
  ) then
    v_rules := v_rules + 1;

    select
      count(*) filter (where log.status = 'FAILED')::integer,
      count(*) filter (
        where log.status in ('PENDING', 'PROCESSING')
      )::integer,
      count(*) filter (where log.status = 'DEAD_LETTER')::integer
    into
      v_failed_events,
      v_pending_events,
      v_dead_letters
    from public.platform_events event
    left join public.event_processing_log log
      on log.event_id = event.id
     and log.consumer_name = 'operations.projector'
    where coalesce(
      event.organization_id,
      'kalabsha-airlines'
    ) = p_organization_id;

    if v_failed_events > 0
       or v_pending_events > 0
       or v_dead_letters > 0 then
      v_created := public.upsert_smart_operations_finding(
        v_run_id,
        p_organization_id,
        'event-platform-health',
        'event_platform_degraded',
        case
          when v_dead_letters > 0 then 'critical'
          when v_failed_events > 0 then 'high'
          else 'medium'
        end,
        'Event Platform requires attention',
        format(
          '%s failed, %s pending and %s dead-letter events were detected.',
          v_failed_events,
          v_pending_events,
          v_dead_letters
        ),
        'Open Core Health, inspect the oldest unhealthy event and retry or requeue it after correcting the cause.',
        'event_platform',
        null,
        1,
        jsonb_build_object(
          'failedEvents', v_failed_events,
          'pendingEvents', v_pending_events,
          'deadLetterEvents', v_dead_letters
        )
      );

      if v_created then
        v_opened := v_opened + 1;
      else
        v_refreshed := v_refreshed + 1;
      end if;
    end if;
  end if;

  -- Rule 2: Active flights without recent operational events.
  if exists (
    select 1
    from public.smart_operations_ai_policies
    where organization_id = p_organization_id
      and policy_key = 'stalled_flight'
      and enabled = true
  ) then
    v_rules := v_rules + 1;

    for v_record in
      select
        projection.booking_id,
        projection.flight_number,
        projection.status,
        projection.last_event_at,
        extract(
          epoch from (now() - projection.last_event_at)
        ) / 3600.0 as age_hours
      from public.operations_flight_projection projection
      where coalesce(
        projection.organization_id,
        'kalabsha-airlines'
      ) = p_organization_id
        and projection.status in (
          'booked',
          'boarding',
          'departed',
          'enroute',
          'landed'
        )
        and projection.last_event_at <
          now() - make_interval(hours => v_stalled_hours)
    loop
      v_created := public.upsert_smart_operations_finding(
        v_run_id,
        p_organization_id,
        'stalled-flight:' || v_record.booking_id::text,
        'stalled_flight',
        case
          when v_record.age_hours >= v_stalled_hours * 2
            then 'high'
          else 'medium'
        end,
        'Active flight appears stalled',
        format(
          '%s has not produced a new operational event for %s hours.',
          coalesce(v_record.flight_number, 'The active flight'),
          round(v_record.age_hours::numeric, 1)
        ),
        'Verify the pilot session and booking state before cancelling, expiring or manually recovering the flight.',
        'flight_booking',
        v_record.booking_id::text,
        0.93,
        jsonb_build_object(
          'bookingId', v_record.booking_id,
          'flightNumber', v_record.flight_number,
          'status', v_record.status,
          'lastEventAt', v_record.last_event_at,
          'ageHours', round(v_record.age_hours::numeric, 1)
        )
      );

      if v_created then
        v_opened := v_opened + 1;
      else
        v_refreshed := v_refreshed + 1;
      end if;
    end loop;
  end if;

  -- Rule 3: Active flight without an aircraft.
  if exists (
    select 1
    from public.smart_operations_ai_policies
    where organization_id = p_organization_id
      and policy_key = 'unassigned_aircraft'
      and enabled = true
  ) then
    v_rules := v_rules + 1;

    for v_record in
      select booking_id, flight_number, status
      from public.operations_flight_projection
      where coalesce(
        organization_id,
        'kalabsha-airlines'
      ) = p_organization_id
        and status in (
          'booked',
          'boarding',
          'departed',
          'enroute',
          'landed'
        )
        and aircraft_id is null
    loop
      v_created := public.upsert_smart_operations_finding(
        v_run_id,
        p_organization_id,
        'unassigned-aircraft:' || v_record.booking_id::text,
        'unassigned_aircraft',
        'high',
        'Active flight has no aircraft assignment',
        format(
          '%s is waiting for an aircraft assignment.',
          coalesce(v_record.flight_number, 'An active flight')
        ),
        'Assign an available aircraft of the required fleet type before the operation advances.',
        'flight_booking',
        v_record.booking_id::text,
        1,
        jsonb_build_object(
          'bookingId', v_record.booking_id,
          'flightNumber', v_record.flight_number,
          'status', v_record.status
        )
      );

      if v_created then
        v_opened := v_opened + 1;
      else
        v_refreshed := v_refreshed + 1;
      end if;
    end loop;
  end if;

  -- Rule 4: Completed flight with no linked PIREP after a grace period.
  if exists (
    select 1
    from public.smart_operations_ai_policies
    where organization_id = p_organization_id
      and policy_key = 'completed_without_pirep'
      and enabled = true
  ) then
    v_rules := v_rules + 1;

    for v_record in
      select
        booking_id,
        flight_number,
        completed_at,
        extract(
          epoch from (now() - completed_at)
        ) / 3600.0 as age_hours
      from public.operations_flight_projection
      where coalesce(
        organization_id,
        'kalabsha-airlines'
      ) = p_organization_id
        and status = 'completed'
        and pirep_id is null
        and completed_at is not null
        and completed_at <
          now() - make_interval(hours => v_missing_pirep_hours)
    loop
      v_created := public.upsert_smart_operations_finding(
        v_run_id,
        p_organization_id,
        'completed-without-pirep:' || v_record.booking_id::text,
        'completed_without_pirep',
        case when v_record.age_hours >= 24 then 'high' else 'medium' end,
        'Completed flight is missing a PIREP',
        format(
          '%s completed %s hours ago without a linked PIREP.',
          coalesce(v_record.flight_number, 'The flight'),
          round(v_record.age_hours::numeric, 1)
        ),
        'Confirm that an Auto PIREP draft exists and ask the pilot to review and submit it.',
        'flight_booking',
        v_record.booking_id::text,
        0.98,
        jsonb_build_object(
          'bookingId', v_record.booking_id,
          'flightNumber', v_record.flight_number,
          'completedAt', v_record.completed_at,
          'ageHours', round(v_record.age_hours::numeric, 1)
        )
      );

      if v_created then
        v_opened := v_opened + 1;
      else
        v_refreshed := v_refreshed + 1;
      end if;
    end loop;
  end if;

  -- Rule 5: Submitted PIREPs waiting too long for review.
  if exists (
    select 1
    from public.smart_operations_ai_policies
    where organization_id = p_organization_id
      and policy_key = 'pirep_review_delayed'
      and enabled = true
  ) then
    v_rules := v_rules + 1;

    for v_record in
      select
        id,
        flight_number,
        created_at,
        extract(
          epoch from (now() - created_at)
        ) / 3600.0 as age_hours
      from public.pireps
      where status = 'submitted'
        and created_at <
          now() - make_interval(hours => v_pirep_review_hours)
    loop
      v_created := public.upsert_smart_operations_finding(
        v_run_id,
        p_organization_id,
        'pirep-review-delayed:' || v_record.id::text,
        'pirep_review_delayed',
        case
          when v_record.age_hours >= v_pirep_review_hours * 3
            then 'high'
          else 'medium'
        end,
        'PIREP review is delayed',
        format(
          '%s has waited %s hours for review.',
          coalesce(v_record.flight_number, 'A submitted PIREP'),
          round(v_record.age_hours::numeric, 1)
        ),
        'Review the report, approve it or return it with a clear reason.',
        'pirep',
        v_record.id::text,
        1,
        jsonb_build_object(
          'pirepId', v_record.id,
          'flightNumber', v_record.flight_number,
          'submittedAt', v_record.created_at,
          'ageHours', round(v_record.age_hours::numeric, 1)
        )
      );

      if v_created then
        v_opened := v_opened + 1;
      else
        v_refreshed := v_refreshed + 1;
      end if;
    end loop;
  end if;

  -- Rule 6: An active aircraft assignment without synchronized state.
  if exists (
    select 1
    from public.smart_operations_ai_policies
    where organization_id = p_organization_id
      and policy_key = 'aircraft_state_missing'
      and enabled = true
  ) then
    v_rules := v_rules + 1;

    for v_record in
      select
        projection.booking_id,
        projection.aircraft_id,
        projection.flight_number,
        projection.status
      from public.operations_flight_projection projection
      where coalesce(
        projection.organization_id,
        'kalabsha-airlines'
      ) = p_organization_id
        and projection.status in (
          'booked',
          'boarding',
          'departed',
          'enroute',
          'landed'
        )
        and projection.aircraft_id is not null
        and not exists (
          select 1
          from public.aircraft_operational_state state
          where state.aircraft_id = projection.aircraft_id
        )
    loop
      v_created := public.upsert_smart_operations_finding(
        v_run_id,
        p_organization_id,
        'aircraft-state-missing:' || v_record.booking_id::text,
        'aircraft_state_missing',
        'high',
        'Aircraft operational state is missing',
        format(
          '%s references an aircraft without a synchronized operational-state record.',
          coalesce(v_record.flight_number, 'An active flight')
        ),
        'Rebuild the aircraft state from the event stream before assigning the aircraft elsewhere.',
        'aircraft',
        v_record.aircraft_id::text,
        0.97,
        jsonb_build_object(
          'bookingId', v_record.booking_id,
          'aircraftId', v_record.aircraft_id,
          'flightNumber', v_record.flight_number,
          'status', v_record.status
        )
      );

      if v_created then
        v_opened := v_opened + 1;
      else
        v_refreshed := v_refreshed + 1;
      end if;
    end loop;
  end if;

  -- Findings not detected in this run are automatically cleared.
  update public.smart_operations_ai_findings
  set
    status = 'resolved',
    resolved_at = now(),
    resolved_by = null,
    resolution_note = 'Automatically cleared by a later analysis run.',
    updated_at = now()
  where organization_id = p_organization_id
    and status in ('open', 'acknowledged')
    and finding_type in (
      'event_platform_degraded',
      'stalled_flight',
      'unassigned_aircraft',
      'completed_without_pirep',
      'pirep_review_delayed',
      'aircraft_state_missing'
    )
    and last_run_id is distinct from v_run_id;

  get diagnostics v_resolved = row_count;

  select greatest(
    0,
    100 - coalesce(sum(
      case severity
        when 'critical' then 30
        when 'high' then 15
        when 'medium' then 7
        else 2
      end
    ), 0)
  )::integer
  into v_health_score
  from public.smart_operations_ai_findings
  where organization_id = p_organization_id
    and status in ('open', 'acknowledged');

  update public.smart_operations_ai_runs
  set
    status = 'completed',
    rules_evaluated = v_rules,
    findings_opened = v_opened,
    findings_refreshed = v_refreshed,
    findings_auto_resolved = v_resolved,
    health_score = v_health_score,
    summary = jsonb_build_object(
      'failedEvents', v_failed_events,
      'pendingEvents', v_pending_events,
      'deadLetterEvents', v_dead_letters,
      'openFindings', (
        select count(*)
        from public.smart_operations_ai_findings
        where organization_id = p_organization_id
          and status in ('open', 'acknowledged')
      )
    ),
    completed_at = now()
  where id = v_run_id;

  perform public.append_domain_event(
    p_event_type => 'operations.analysis_completed',
    p_aggregate_type => 'operations_analysis',
    p_aggregate_id => v_run_id::text,
    p_actor_id => p_requested_by::text,
    p_organization_id => p_organization_id,
    p_payload => jsonb_build_object(
      'runId', v_run_id,
      'organizationId', p_organization_id,
      'rulesEvaluated', v_rules,
      'findingsOpened', v_opened,
      'findingsRefreshed', v_refreshed,
      'findingsAutoResolved', v_resolved,
      'healthScore', v_health_score
    ),
    p_metadata => jsonb_build_object(
      'source', 'smart-operations-ai.v1',
      'privacy', 'internal',
      'explainable', true
    )
  );

  return v_run_id;
exception
  when others then
    if v_run_id is not null then
      update public.smart_operations_ai_runs
      set
        status = 'failed',
        error = sqlerrm,
        completed_at = now()
      where id = v_run_id;
    end if;

    raise;
end;
$$;

revoke all on function public.run_smart_operations_analysis(
  text, uuid, text
) from public, anon, authenticated;

grant execute on function public.run_smart_operations_analysis(
  text, uuid, text
) to service_role;

create or replace function public.set_smart_operations_finding_status(
  p_finding_id uuid,
  p_status text,
  p_actor_id uuid,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_finding public.smart_operations_ai_findings%rowtype;
  v_event_type text;
begin
  if p_status not in ('open', 'acknowledged', 'resolved') then
    raise exception 'Invalid finding status: %', p_status;
  end if;

  select *
  into v_finding
  from public.smart_operations_ai_findings
  where id = p_finding_id
  for update;

  if not found then
    raise exception 'Smart Operations finding not found';
  end if;

  update public.smart_operations_ai_findings
  set
    status = p_status,
    acknowledged_at = case
      when p_status = 'acknowledged' then now()
      when p_status = 'open' then null
      else acknowledged_at
    end,
    acknowledged_by = case
      when p_status = 'acknowledged' then p_actor_id
      when p_status = 'open' then null
      else acknowledged_by
    end,
    resolved_at = case
      when p_status = 'resolved' then now()
      else null
    end,
    resolved_by = case
      when p_status = 'resolved' then p_actor_id
      else null
    end,
    resolution_note = case
      when p_status = 'resolved' then nullif(btrim(p_note), '')
      when p_status = 'open' then null
      else resolution_note
    end,
    updated_at = now()
  where id = p_finding_id;

  v_event_type := case p_status
    when 'acknowledged' then 'operations.finding_acknowledged'
    when 'resolved' then 'operations.finding_resolved'
    else 'operations.finding_reopened'
  end;

  perform public.append_domain_event(
    p_event_type => v_event_type,
    p_aggregate_type => 'operations_finding',
    p_aggregate_id => p_finding_id::text,
    p_actor_id => p_actor_id::text,
    p_organization_id => v_finding.organization_id,
    p_payload => jsonb_build_object(
      'findingId', p_finding_id,
      'findingType', v_finding.finding_type,
      'previousStatus', v_finding.status,
      'status', p_status,
      'note', nullif(btrim(p_note), '')
    ),
    p_metadata => jsonb_build_object(
      'source', 'smart-operations-ai.console',
      'privacy', 'internal'
    )
  );

  return true;
end;
$$;

revoke all on function public.set_smart_operations_finding_status(
  uuid, text, uuid, text
) from public, anon, authenticated;

grant execute on function public.set_smart_operations_finding_status(
  uuid, text, uuid, text
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
      'reopen_operations_finding'
    )
  );

-- Produce the first explainable operational snapshot.
select public.run_smart_operations_analysis(
  'kalabsha-airlines',
  null,
  'backfill'
);
