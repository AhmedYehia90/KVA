-- KVA Mentor AI Pack v1.0
-- Explainable adaptive pilot mentoring built on Digital Flight Companion.

create table if not exists public.mentor_ai_sessions (
  id uuid primary key default gen_random_uuid(),
  debrief_id uuid not null unique
    references public.flight_companion_debriefs(id) on delete cascade,
  booking_id uuid not null
    references public.flight_bookings(id) on delete cascade,
  pilot_id uuid not null
    references public.profiles(id) on delete cascade,
  organization_id text not null default 'kalabsha-airlines'
    references public.platform_organizations(id) on delete restrict,
  flight_number text not null,
  status text not null default 'ready' check (
    status in ('ready', 'reflected', 'goal_created', 'completed')
  ),
  tone text not null check (
    tone in ('supportive', 'professional', 'direct')
  ),
  confidence numeric(4,3) not null check (
    confidence >= 0 and confidence <= 1
  ),
  primary_focus_code text not null,
  primary_focus jsonb not null default '{}'::jsonb,
  opening_message text not null,
  diagnosis text not null,
  lesson_plan jsonb not null default '[]'::jsonb,
  recommended_goal jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reflected_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_mentor_sessions_pilot_created
on public.mentor_ai_sessions(pilot_id, created_at desc);

create index if not exists idx_mentor_sessions_status
on public.mentor_ai_sessions(pilot_id, status, created_at desc);

create table if not exists public.mentor_ai_reflections (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.mentor_ai_sessions(id) on delete cascade,
  pilot_id uuid not null
    references public.profiles(id) on delete cascade,
  response_type text not null check (
    response_type in (
      'understood',
      'need_simpler',
      'need_example',
      'ready_to_practice',
      'custom'
    )
  ),
  note text,
  mentor_response text not null,
  created_at timestamptz not null default now(),
  check (
    note is null
    or char_length(btrim(note)) between 1 and 2000
  )
);

create index if not exists idx_mentor_reflections_session_created
on public.mentor_ai_reflections(session_id, created_at desc);

create table if not exists public.mentor_ai_goals (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null
    references public.profiles(id) on delete cascade,
  source_session_id uuid not null
    references public.mentor_ai_sessions(id) on delete cascade,
  source_debrief_id uuid not null
    references public.flight_companion_debriefs(id) on delete cascade,
  organization_id text not null default 'kalabsha-airlines'
    references public.platform_organizations(id) on delete restrict,
  category text not null check (
    category in (
      'landing_control',
      'timing_control',
      'data_discipline',
      'record_awareness',
      'consistency'
    )
  ),
  title text not null,
  objective text not null,
  status text not null default 'active' check (
    status in ('active', 'paused', 'completed')
  ),
  progress_count integer not null default 0 check (
    progress_count >= 0
  ),
  target_count integer not null check (
    target_count > 0
  ),
  success_codes jsonb not null default '[]'::jsonb,
  last_evaluated_debrief_id uuid
    references public.flight_companion_debriefs(id) on delete set null,
  last_progress_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_mentor_goals_pilot_status
on public.mentor_ai_goals(pilot_id, status, created_at desc);

create unique index if not exists uq_mentor_open_goal_category
on public.mentor_ai_goals(pilot_id, category)
where status in ('active', 'paused');

alter table public.mentor_ai_sessions enable row level security;
alter table public.mentor_ai_reflections enable row level security;
alter table public.mentor_ai_goals enable row level security;

drop policy if exists mentor_sessions_select_own
on public.mentor_ai_sessions;

create policy mentor_sessions_select_own
on public.mentor_ai_sessions
for select
to authenticated
using (auth.uid() = pilot_id);

drop policy if exists mentor_reflections_select_own
on public.mentor_ai_reflections;

create policy mentor_reflections_select_own
on public.mentor_ai_reflections
for select
to authenticated
using (auth.uid() = pilot_id);

drop policy if exists mentor_goals_select_own
on public.mentor_ai_goals;

create policy mentor_goals_select_own
on public.mentor_ai_goals
for select
to authenticated
using (auth.uid() = pilot_id);


create or replace function public.build_mentor_ai_session(
  p_debrief_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debrief public.flight_companion_debriefs%rowtype;
  v_focus jsonb;
  v_focus_code text;
  v_category text;
  v_lesson_plan jsonb;
  v_recommended_goal jsonb;
  v_opening_message text;
  v_diagnosis text;
  v_session_id uuid;
  v_event_type text := 'mentor.session_created';
begin
  select *
  into v_debrief
  from public.flight_companion_debriefs
  where id = p_debrief_id;

  if not found then
    raise exception 'Companion debrief not found';
  end if;

  select item.value
  into v_focus
  from jsonb_array_elements(
    coalesce(v_debrief.focus_items, '[]'::jsonb)
  ) as item(value)
  where item.value ->> 'code' <> 'replay_integrity_warning'
  limit 1;

  if v_focus is null then
    select item.value
    into v_focus
    from jsonb_array_elements(
      coalesce(v_debrief.focus_items, '[]'::jsonb)
    ) as item(value)
    limit 1;
  end if;

  if v_focus is null then
    v_focus := jsonb_build_object(
      'code', 'consistency_next',
      'title', 'Repeat the standard',
      'message',
        'No major focus item was detected. Reproduce the same stable result on the next flight.',
      'evidence', '{}'::jsonb
    );
  end if;

  v_focus_code := coalesce(
    nullif(v_focus ->> 'code', ''),
    'consistency_next'
  );

  v_category := case
    when v_focus_code in ('landing_firm', 'landing_hard')
      then 'landing_control'
    when v_focus_code = 'block_time_variance'
      then 'timing_control'
    when v_focus_code in (
      'landing_data_missing',
      'fuel_data_missing'
    )
      then 'data_discipline'
    when v_focus_code = 'replay_integrity_warning'
      then 'record_awareness'
    else 'consistency'
  end;

  v_lesson_plan := case v_category
    when 'landing_control' then
      jsonb_build_array(
        jsonb_build_object(
          'phase', 'Before approach',
          'title', 'Create a stable setup',
          'guidance',
            'Review the expected approach sequence early and avoid carrying unfinished tasks into the final segment.',
          'why',
            'A settled setup leaves more attention for vertical-speed and flare control.'
        ),
        jsonb_build_object(
          'phase', 'Final approach',
          'title', 'Protect the descent trend',
          'guidance',
            'Watch the trend rather than chasing a single indication. Make small, early corrections.',
          'why',
            'Large late corrections often create an unstable touchdown picture.'
        ),
        jsonb_build_object(
          'phase', 'Flare and touchdown',
          'title', 'Reduce descent progressively',
          'guidance',
            'Use a smooth transition and keep the correction proportional to what the aircraft is doing.',
          'why',
            'Progressive control supports a consistent landing without forcing a cosmetic result.'
        )
      )
    when 'timing_control' then
      jsonb_build_array(
        jsonb_build_object(
          'phase', 'Before departure',
          'title', 'Know the planned block time',
          'guidance',
            'Keep the route plan visible and identify where taxi, cruise or turnaround variation is most likely.',
          'why',
            'A clear baseline makes operational delays easier to understand after the flight.'
        ),
        jsonb_build_object(
          'phase', 'During flight',
          'title', 'Observe the source of variance',
          'guidance',
            'Notice whether the difference comes from ground time, cruise profile or operational interruption.',
          'why',
            'The useful lesson is the cause of the variance, not the number alone.'
        ),
        jsonb_build_object(
          'phase', 'After arrival',
          'title', 'Compare actual with planned',
          'guidance',
            'Review the difference and record a brief explanation when it is material.',
          'why',
            'Repeated comparisons build better planning judgment.'
        )
      )
    when 'data_discipline' then
      jsonb_build_array(
        jsonb_build_object(
          'phase', 'Before flight',
          'title', 'Prepare the evidence fields',
          'guidance',
            'Confirm that landing-rate and fuel-used values will be available before submitting the PIREP.',
          'why',
            'The mentor can only coach from evidence that KVA OS actually records.'
        ),
        jsonb_build_object(
          'phase', 'After landing',
          'title', 'Capture the values',
          'guidance',
            'Record the available landing and fuel information before leaving the flight workflow.',
          'why',
            'Complete records make later comparisons more precise.'
        ),
        jsonb_build_object(
          'phase', 'Before submission',
          'title', 'Check completeness',
          'guidance',
            'Review the PIREP fields once and leave unavailable data explicitly empty.',
          'why',
            'Honest missing data is safer than estimated or invented data.'
        )
      )
    when 'record_awareness' then
      jsonb_build_array(
        jsonb_build_object(
          'phase', 'Review',
          'title', 'Separate system evidence from pilot performance',
          'guidance',
            'Treat replay-integrity warnings as data-quality notes unless another recorded metric supports a pilot-performance conclusion.',
          'why',
            'A platform record problem must not become an unsupported judgment about the pilot.'
        ),
        jsonb_build_object(
          'phase', 'Verification',
          'title', 'Use the source record',
          'guidance',
            'Review the Black Box Replay integrity checks and identify which system link is incomplete.',
          'why',
            'The exact warning is more useful than a generic caution.'
        )
      )
    else
      jsonb_build_array(
        jsonb_build_object(
          'phase', 'Before next flight',
          'title', 'Choose one repeatable cue',
          'guidance',
            'Keep one short cue from this debrief and use it throughout the next flight.',
          'why',
            'Consistency is easier to build when the next objective is simple and observable.'
        ),
        jsonb_build_object(
          'phase', 'After next flight',
          'title', 'Compare, do not guess',
          'guidance',
            'Use the next recorded debrief to confirm whether the standard was repeated.',
          'why',
            'Progress should be based on evidence across flights.'
        )
      )
  end;

  v_recommended_goal := case v_category
    when 'landing_control' then
      jsonb_build_object(
        'category', v_category,
        'title', 'Build consistent touchdown control',
        'objective',
          'Record two later flights with a stable or excellent landing assessment.',
        'targetCount', 2,
        'successCodes',
          jsonb_build_array('landing_stable', 'landing_excellent')
      )
    when 'timing_control' then
      jsonb_build_object(
        'category', v_category,
        'title', 'Improve block-time control',
        'objective',
          'Complete two flights with precise or reasonable block-time variance.',
        'targetCount', 2,
        'successCodes',
          jsonb_build_array(
            'block_time_precise',
            'block_time_reasonable'
          )
      )
    when 'data_discipline' then
      jsonb_build_object(
        'category', v_category,
        'title', 'Complete the flight evidence',
        'objective',
          'Submit two later PIREPs with landing-rate and fuel-used data recorded.',
        'targetCount', 2,
        'successCodes',
          jsonb_build_array(
            'landing_data_recorded',
            'fuel_data_recorded'
          )
      )
    when 'record_awareness' then
      jsonb_build_object(
        'category', v_category,
        'title', 'Verify the next operational record',
        'objective',
          'Complete one flight whose Black Box Replay integrity is healthy.',
        'targetCount', 1,
        'successCodes',
          jsonb_build_array('replay_integrity_healthy')
      )
    else
      jsonb_build_object(
        'category', 'consistency',
        'title', 'Repeat the operational standard',
        'objective',
          'Complete two later flights with a score of at least 85 and a healthy replay.',
        'targetCount', 2,
        'successCodes',
          jsonb_build_array(
            'score_85_plus',
            'replay_integrity_healthy'
          )
      )
  end;

  v_opening_message := case v_debrief.tone
    when 'direct' then
      format(
        '%s is complete. Keep the strengths, then work on %s.',
        v_debrief.flight_number,
        lower(coalesce(v_focus ->> 'title', 'the next focus'))
      )
    when 'professional' then
      format(
        '%s provides a clear learning point: preserve the successful elements and address %s.',
        v_debrief.flight_number,
        lower(coalesce(v_focus ->> 'title', 'the next focus'))
      )
    else
      format(
        'You completed %s. Keep what worked, and take one calm step toward %s.',
        v_debrief.flight_number,
        lower(coalesce(v_focus ->> 'title', 'the next focus'))
      )
  end;

  v_diagnosis := case
    when v_focus_code = 'replay_integrity_warning' then
      'The recorded concern belongs to the system evidence chain and is not automatically a pilot-performance issue.'
    else
      format(
        '%s The mentor has converted this into a practical next-flight lesson.',
        coalesce(v_focus ->> 'message', 'A clear next step is available.')
      )
  end;

  select session.id
  into v_session_id
  from public.mentor_ai_sessions session
  where session.debrief_id = p_debrief_id;

  if v_session_id is null then
    insert into public.mentor_ai_sessions (
      debrief_id,
      booking_id,
      pilot_id,
      organization_id,
      flight_number,
      status,
      tone,
      confidence,
      primary_focus_code,
      primary_focus,
      opening_message,
      diagnosis,
      lesson_plan,
      recommended_goal,
      created_at,
      updated_at
    )
    values (
      v_debrief.id,
      v_debrief.booking_id,
      v_debrief.pilot_id,
      v_debrief.organization_id,
      v_debrief.flight_number,
      'ready',
      v_debrief.tone,
      v_debrief.confidence,
      v_focus_code,
      v_focus,
      v_opening_message,
      v_diagnosis,
      v_lesson_plan,
      v_recommended_goal,
      now(),
      now()
    )
    returning id into v_session_id;
  else
    update public.mentor_ai_sessions
    set
      tone = v_debrief.tone,
      confidence = v_debrief.confidence,
      primary_focus_code = v_focus_code,
      primary_focus = v_focus,
      opening_message = v_opening_message,
      diagnosis = v_diagnosis,
      lesson_plan = v_lesson_plan,
      recommended_goal = v_recommended_goal,
      updated_at = now()
    where id = v_session_id;

    v_event_type := 'mentor.session_regenerated';
  end if;

  perform public.append_domain_event(
    p_event_type => v_event_type,
    p_aggregate_type => 'mentor_session',
    p_aggregate_id => v_session_id::text,
    p_actor_id => v_debrief.pilot_id::text,
    p_organization_id => v_debrief.organization_id,
    p_payload => jsonb_build_object(
      'sessionId', v_session_id,
      'debriefId', v_debrief.id,
      'bookingId', v_debrief.booking_id,
      'pilotId', v_debrief.pilot_id,
      'flightNumber', v_debrief.flight_number,
      'primaryFocusCode', v_focus_code,
      'goalCategory', v_category,
      'confidence', v_debrief.confidence
    ),
    p_metadata => jsonb_build_object(
      'source', 'mentor-ai.v1',
      'privacy', 'pilot_private',
      'explainable', true
    )
  );

  return v_session_id;
end;
$$;

revoke all on function public.build_mentor_ai_session(uuid)
from public, anon, authenticated;

grant execute on function public.build_mentor_ai_session(uuid)
to service_role;


create or replace function public.record_mentor_ai_reflection(
  p_session_id uuid,
  p_response_type text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.mentor_ai_sessions%rowtype;
  v_response text;
  v_reflection_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_response_type not in (
    'understood',
    'need_simpler',
    'need_example',
    'ready_to_practice',
    'custom'
  ) then
    raise exception 'Invalid mentor response type';
  end if;

  if p_note is not null
     and (
       char_length(btrim(p_note)) < 1
       or char_length(btrim(p_note)) > 2000
     ) then
    raise exception 'Reflection note must contain between 1 and 2000 characters';
  end if;

  select *
  into v_session
  from public.mentor_ai_sessions
  where id = p_session_id
    and pilot_id = v_user_id
  for update;

  if not found then
    raise exception 'Mentor session not found';
  end if;

  v_response := case p_response_type
    when 'understood' then
      format(
        'Good. Keep the cue short: %s. Use the next debrief to verify the result.',
        coalesce(
          v_session.primary_focus ->> 'title',
          'repeat the next step'
        )
      )
    when 'need_simpler' then
      format(
        'Simpler version: focus on one observable action connected to %s, then check the recorded result after the flight.',
        lower(
          coalesce(
            v_session.primary_focus ->> 'title',
            'the selected focus'
          )
        )
      )
    when 'need_example' then
      case
        when v_session.primary_focus_code in (
          'landing_firm',
          'landing_hard'
        ) then
          'Example: finish the approach setup early, protect a stable descent trend, and make small corrections rather than one large late correction.'
        when v_session.primary_focus_code = 'block_time_variance' then
          'Example: compare planned and actual block time, then identify whether the difference came mainly from taxi, cruise or an operational interruption.'
        when v_session.primary_focus_code in (
          'landing_data_missing',
          'fuel_data_missing'
        ) then
          'Example: before PIREP submission, check that landing-rate and fuel-used fields contain recorded values or remain honestly empty.'
        else
          'Example: choose one cue before the flight, apply it consistently, then compare the next evidence-backed debrief with this one.'
      end
    when 'ready_to_practice' then
      'Use the recommended goal below as the next practice target. Progress will be measured from future debrief evidence.'
    else
      'Your reflection has been recorded. Keep the lesson connected to measurable flight evidence.'
  end;

  insert into public.mentor_ai_reflections (
    session_id,
    pilot_id,
    response_type,
    note,
    mentor_response
  )
  values (
    v_session.id,
    v_user_id,
    p_response_type,
    case
      when p_note is null then null
      else btrim(p_note)
    end,
    v_response
  )
  returning id into v_reflection_id;

  update public.mentor_ai_sessions
  set
    status = case
      when status = 'ready' then 'reflected'
      else status
    end,
    reflected_at = coalesce(reflected_at, now()),
    updated_at = now()
  where id = v_session.id;

  perform public.append_domain_event(
    p_event_type => 'mentor.reflection_recorded',
    p_aggregate_type => 'mentor_session',
    p_aggregate_id => v_session.id::text,
    p_actor_id => v_user_id::text,
    p_organization_id => v_session.organization_id,
    p_payload => jsonb_build_object(
      'sessionId', v_session.id,
      'reflectionId', v_reflection_id,
      'debriefId', v_session.debrief_id,
      'pilotId', v_user_id,
      'flightNumber', v_session.flight_number,
      'responseType', p_response_type
    ),
    p_metadata => jsonb_build_object(
      'source', 'mentor-ai.pilot',
      'privacy', 'pilot_private'
    )
  );

  return v_reflection_id;
end;
$$;

revoke all on function public.record_mentor_ai_reflection(
  uuid, text, text
) from public, anon;

grant execute on function public.record_mentor_ai_reflection(
  uuid, text, text
) to authenticated;

create or replace function public.create_mentor_ai_goal(
  p_session_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.mentor_ai_sessions%rowtype;
  v_category text;
  v_goal_id uuid;
  v_target_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_session
  from public.mentor_ai_sessions
  where id = p_session_id
    and pilot_id = v_user_id
  for update;

  if not found then
    raise exception 'Mentor session not found';
  end if;

  v_category := coalesce(
    nullif(v_session.recommended_goal ->> 'category', ''),
    'consistency'
  );

  select goal.id
  into v_goal_id
  from public.mentor_ai_goals goal
  where goal.pilot_id = v_user_id
    and goal.category = v_category
    and goal.status in ('active', 'paused')
  order by goal.created_at desc
  limit 1;

  if v_goal_id is not null then
    return v_goal_id;
  end if;

  begin
    v_target_count :=
      (v_session.recommended_goal ->> 'targetCount')::integer;
  exception
    when invalid_text_representation then
      v_target_count := 2;
  end;

  v_target_count := greatest(1, coalesce(v_target_count, 2));

  insert into public.mentor_ai_goals (
    pilot_id,
    source_session_id,
    source_debrief_id,
    organization_id,
    category,
    title,
    objective,
    status,
    progress_count,
    target_count,
    success_codes,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    v_session.id,
    v_session.debrief_id,
    v_session.organization_id,
    v_category,
    coalesce(
      nullif(v_session.recommended_goal ->> 'title', ''),
      'Personal mentor goal'
    ),
    coalesce(
      nullif(v_session.recommended_goal ->> 'objective', ''),
      'Apply the mentor lesson and verify progress from future debriefs.'
    ),
    'active',
    0,
    v_target_count,
    coalesce(
      v_session.recommended_goal -> 'successCodes',
      '[]'::jsonb
    ),
    now(),
    now()
  )
  returning id into v_goal_id;

  update public.mentor_ai_sessions
  set
    status = 'goal_created',
    updated_at = now()
  where id = v_session.id;

  perform public.append_domain_event(
    p_event_type => 'mentor.goal_created',
    p_aggregate_type => 'mentor_goal',
    p_aggregate_id => v_goal_id::text,
    p_actor_id => v_user_id::text,
    p_organization_id => v_session.organization_id,
    p_payload => jsonb_build_object(
      'goalId', v_goal_id,
      'sessionId', v_session.id,
      'debriefId', v_session.debrief_id,
      'pilotId', v_user_id,
      'flightNumber', v_session.flight_number,
      'category', v_category,
      'targetCount', v_target_count
    ),
    p_metadata => jsonb_build_object(
      'source', 'mentor-ai.pilot',
      'privacy', 'pilot_private'
    )
  );

  return v_goal_id;
end;
$$;

revoke all on function public.create_mentor_ai_goal(uuid)
from public, anon;

grant execute on function public.create_mentor_ai_goal(uuid)
to authenticated;

create or replace function public.set_mentor_ai_goal_status(
  p_goal_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal public.mentor_ai_goals%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_status not in ('active', 'paused', 'completed') then
    raise exception 'Invalid mentor goal status';
  end if;

  select *
  into v_goal
  from public.mentor_ai_goals
  where id = p_goal_id
    and pilot_id = v_user_id
  for update;

  if not found then
    raise exception 'Mentor goal not found';
  end if;

  update public.mentor_ai_goals
  set
    status = p_status,
    completed_at = case
      when p_status = 'completed' then coalesce(completed_at, now())
      else null
    end,
    updated_at = now()
  where id = p_goal_id;

  perform public.append_domain_event(
    p_event_type => case
      when p_status = 'completed' then 'mentor.goal_completed'
      when p_status = 'paused' then 'mentor.goal_paused'
      else 'mentor.goal_resumed'
    end,
    p_aggregate_type => 'mentor_goal',
    p_aggregate_id => p_goal_id::text,
    p_actor_id => v_user_id::text,
    p_organization_id => v_goal.organization_id,
    p_payload => jsonb_build_object(
      'goalId', p_goal_id,
      'pilotId', v_user_id,
      'category', v_goal.category,
      'status', p_status,
      'progressCount', v_goal.progress_count,
      'targetCount', v_goal.target_count
    ),
    p_metadata => jsonb_build_object(
      'source', 'mentor-ai.pilot',
      'privacy', 'pilot_private'
    )
  );

  return true;
end;
$$;

revoke all on function public.set_mentor_ai_goal_status(uuid, text)
from public, anon;

grant execute on function public.set_mentor_ai_goal_status(uuid, text)
to authenticated;


create or replace function public.evaluate_mentor_ai_goals(
  p_debrief_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debrief public.flight_companion_debriefs%rowtype;
  v_goal public.mentor_ai_goals%rowtype;
  v_progressed boolean;
  v_new_progress integer;
  v_completed boolean;
  v_reason text;
  v_updated_count integer := 0;
begin
  select *
  into v_debrief
  from public.flight_companion_debriefs
  where id = p_debrief_id;

  if not found then
    raise exception 'Companion debrief not found';
  end if;

  for v_goal in
    select *
    from public.mentor_ai_goals
    where pilot_id = v_debrief.pilot_id
      and status = 'active'
      and source_debrief_id <> p_debrief_id
      and (
        last_evaluated_debrief_id is null
        or last_evaluated_debrief_id <> p_debrief_id
      )
    order by created_at, id
    for update
  loop
    v_progressed := false;
    v_reason := 'The available evidence did not yet meet this goal.';

    if v_goal.category = 'landing_control' then
      select exists (
        select 1
        from jsonb_array_elements(
          coalesce(v_debrief.strengths, '[]'::jsonb)
        ) as item(value)
        where item.value ->> 'code' in (
          'landing_stable',
          'landing_excellent'
        )
      )
      into v_progressed;

      if v_progressed then
        v_reason :=
          'The debrief recorded a stable or excellent landing.';
      end if;

    elsif v_goal.category = 'timing_control' then
      select exists (
        select 1
        from jsonb_array_elements(
          coalesce(v_debrief.strengths, '[]'::jsonb)
        ) as item(value)
        where item.value ->> 'code' in (
          'block_time_precise',
          'block_time_reasonable'
        )
      )
      into v_progressed;

      if v_progressed then
        v_reason :=
          'The flight stayed inside the accepted block-time range.';
      end if;

    elsif v_goal.category = 'data_discipline' then
      v_progressed :=
        (v_debrief.metrics -> 'landingRate') is not null
        and (v_debrief.metrics -> 'landingRate') <> 'null'::jsonb
        and (v_debrief.metrics -> 'fuelUsedKg') is not null
        and (v_debrief.metrics -> 'fuelUsedKg') <> 'null'::jsonb;

      if v_progressed then
        v_reason :=
          'Landing and fuel evidence were both recorded.';
      end if;

    elsif v_goal.category = 'record_awareness' then
      v_progressed := coalesce(
        (v_debrief.replay_integrity ->> 'healthy')::boolean,
        false
      );

      if v_progressed then
        v_reason :=
          'The next flight record passed replay integrity.';
      end if;

    else
      v_progressed :=
        v_debrief.overall_score >= 85
        and coalesce(
          (v_debrief.replay_integrity ->> 'healthy')::boolean,
          false
        );

      if v_progressed then
        v_reason :=
          'The flight score and replay integrity both met the consistency standard.';
      end if;
    end if;

    v_new_progress := case
      when v_progressed then
        least(v_goal.target_count, v_goal.progress_count + 1)
      else v_goal.progress_count
    end;

    v_completed := v_new_progress >= v_goal.target_count;

    update public.mentor_ai_goals
    set
      progress_count = v_new_progress,
      status = case
        when v_completed then 'completed'
        else status
      end,
      last_evaluated_debrief_id = p_debrief_id,
      last_progress_reason = v_reason,
      completed_at = case
        when v_completed then coalesce(completed_at, now())
        else completed_at
      end,
      updated_at = now()
    where id = v_goal.id;

    if v_progressed then
      perform public.append_domain_event(
        p_event_type => case
          when v_completed then 'mentor.goal_completed'
          else 'mentor.goal_progressed'
        end,
        p_aggregate_type => 'mentor_goal',
        p_aggregate_id => v_goal.id::text,
        p_actor_id => v_debrief.pilot_id::text,
        p_organization_id => v_goal.organization_id,
        p_payload => jsonb_build_object(
          'goalId', v_goal.id,
          'debriefId', p_debrief_id,
          'pilotId', v_debrief.pilot_id,
          'flightNumber', v_debrief.flight_number,
          'category', v_goal.category,
          'progressCount', v_new_progress,
          'targetCount', v_goal.target_count,
          'completed', v_completed,
          'reason', v_reason
        ),
        p_metadata => jsonb_build_object(
          'source', 'mentor-ai.goal-evaluator',
          'privacy', 'pilot_private',
          'explainable', true
        )
      );
    end if;

    v_updated_count := v_updated_count + 1;
  end loop;

  return v_updated_count;
end;
$$;

revoke all on function public.evaluate_mentor_ai_goals(uuid)
from public, anon, authenticated;

grant execute on function public.evaluate_mentor_ai_goals(uuid)
to service_role;

create or replace function public.handle_mentor_ai_companion_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debrief_id uuid;
begin
  if new.event_type not in (
    'companion.debrief_generated',
    'companion.debrief_regenerated'
  ) then
    return new;
  end if;

  begin
    v_debrief_id := nullif(
      new.payload ->> 'debriefId',
      ''
    )::uuid;
  exception
    when invalid_text_representation then
      return new;
  end;

  if v_debrief_id is not null then
    perform public.build_mentor_ai_session(v_debrief_id);
    perform public.evaluate_mentor_ai_goals(v_debrief_id);
  end if;

  return new;
end;
$$;

revoke all on function public.handle_mentor_ai_companion_event()
from public, anon, authenticated;

drop trigger if exists zzz_after_platform_event_mentor_ai
on public.platform_events;

create trigger zzz_after_platform_event_mentor_ai
after insert on public.platform_events
for each row
when (
  new.event_type in (
    'companion.debrief_generated',
    'companion.debrief_regenerated'
  )
)
execute function public.handle_mentor_ai_companion_event();

-- Build private mentor sessions for existing companion debriefs.
do $$
declare
  v_record record;
begin
  for v_record in
    select id
    from public.flight_companion_debriefs
    order by generated_at, id
  loop
    perform public.build_mentor_ai_session(v_record.id);
  end loop;
end
$$;
