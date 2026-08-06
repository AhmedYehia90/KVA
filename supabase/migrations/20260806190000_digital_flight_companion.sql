-- KVA Digital Flight Companion Pack v1.0
-- Evidence-backed pilot debriefs generated after PIREP submission.

create table if not exists public.pilot_companion_preferences (
  pilot_id uuid primary key
    references public.profiles(id) on delete cascade,
  tone text not null default 'supportive' check (
    tone in ('supportive', 'professional', 'direct')
  ),
  detail_level text not null default 'standard' check (
    detail_level in ('concise', 'standard', 'detailed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flight_companion_debriefs (
  id uuid primary key default gen_random_uuid(),
  pirep_id uuid not null unique
    references public.pireps(id) on delete cascade,
  booking_id uuid not null unique
    references public.flight_bookings(id) on delete cascade,
  pilot_id uuid not null
    references public.profiles(id) on delete cascade,
  organization_id text not null default 'kalabsha-airlines'
    references public.platform_organizations(id) on delete restrict,
  flight_number text not null,
  status text not null default 'ready' check (
    status in ('ready', 'acknowledged')
  ),
  tone text not null check (
    tone in ('supportive', 'professional', 'direct')
  ),
  overall_score integer not null check (
    overall_score between 0 and 100
  ),
  confidence numeric(4,3) not null check (
    confidence >= 0 and confidence <= 1
  ),
  headline text not null,
  summary text not null,
  strengths jsonb not null default '[]'::jsonb,
  focus_items jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  replay_integrity jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_companion_debriefs_pilot_generated
on public.flight_companion_debriefs(pilot_id, generated_at desc);

create index if not exists idx_companion_debriefs_status
on public.flight_companion_debriefs(pilot_id, status, generated_at desc);

alter table public.pilot_companion_preferences enable row level security;
alter table public.flight_companion_debriefs enable row level security;

drop policy if exists companion_preferences_select_own
on public.pilot_companion_preferences;

create policy companion_preferences_select_own
on public.pilot_companion_preferences
for select
to authenticated
using (auth.uid() = pilot_id);

drop policy if exists companion_preferences_insert_own
on public.pilot_companion_preferences;

create policy companion_preferences_insert_own
on public.pilot_companion_preferences
for insert
to authenticated
with check (auth.uid() = pilot_id);

drop policy if exists companion_preferences_update_own
on public.pilot_companion_preferences;

create policy companion_preferences_update_own
on public.pilot_companion_preferences
for update
to authenticated
using (auth.uid() = pilot_id)
with check (auth.uid() = pilot_id);

drop policy if exists companion_debriefs_select_own
on public.flight_companion_debriefs;

create policy companion_debriefs_select_own
on public.flight_companion_debriefs
for select
to authenticated
using (auth.uid() = pilot_id);

create or replace function public.generate_flight_companion_debrief(
  p_pirep_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pirep public.pireps%rowtype;
  v_booking public.flight_bookings%rowtype;
  v_planned_block_minutes integer;
  v_tone text := 'supportive';
  v_replay jsonb;
  v_replay_integrity jsonb := '{}'::jsonb;
  v_replay_healthy boolean;
  v_score integer := 70;
  v_evidence_points integer := 1;
  v_landing_abs integer;
  v_variance_minutes integer;
  v_variance_percent numeric;
  v_strengths jsonb := '[]'::jsonb;
  v_focus_items jsonb := '[]'::jsonb;
  v_headline text;
  v_summary text;
  v_confidence numeric(4,3);
  v_debrief_id uuid;
  v_event_type text := 'companion.debrief_generated';
begin
  select *
  into v_pirep
  from public.pireps
  where id = p_pirep_id;

  if not found then
    raise exception 'PIREP not found';
  end if;

  if v_pirep.booking_id is null then
    raise exception 'PIREP has no booking';
  end if;

  select *
  into v_booking
  from public.flight_bookings
  where id = v_pirep.booking_id;

  if not found then
    raise exception 'Flight booking not found';
  end if;

  select route.scheduled_minutes
  into v_planned_block_minutes
  from public.routes route
  where route.id = v_booking.route_id;

  select preference.tone
  into v_tone
  from public.pilot_companion_preferences preference
  where preference.pilot_id = v_pirep.pilot_id;

  v_tone := coalesce(v_tone, 'supportive');

  begin
    v_replay := public.get_flight_black_box_replay(v_booking.id);
    v_replay_integrity := coalesce(v_replay -> 'integrity', '{}'::jsonb);

    if v_replay_integrity ? 'healthy' then
      v_replay_healthy :=
        (v_replay_integrity ->> 'healthy')::boolean;
    end if;
  exception
    when undefined_function then
      v_replay := null;
      v_replay_integrity := jsonb_build_object(
        'available',
        false,
        'reason',
        'Black Box Replay is unavailable.'
      );
      v_replay_healthy := null;
  end;

  if v_pirep.landing_rate is null then
    v_focus_items := v_focus_items || jsonb_build_array(
      jsonb_build_object(
        'code', 'landing_data_missing',
        'title', 'Capture landing data',
        'message',
          'No landing rate was recorded, so the companion cannot assess touchdown consistency.',
        'evidence', jsonb_build_object('landingRate', null)
      )
    );
  else
    v_evidence_points := v_evidence_points + 1;
    v_landing_abs := abs(v_pirep.landing_rate);

    if v_landing_abs <= 150 then
      v_score := v_score + 20;
      v_strengths := v_strengths || jsonb_build_array(
        jsonb_build_object(
          'code', 'landing_excellent',
          'title', 'Excellent touchdown control',
          'message',
            'The recorded landing rate indicates a smooth and highly controlled touchdown.',
          'evidence',
            jsonb_build_object('landingRate', v_pirep.landing_rate)
        )
      );
    elsif v_landing_abs <= 300 then
      v_score := v_score + 14;
      v_strengths := v_strengths || jsonb_build_array(
        jsonb_build_object(
          'code', 'landing_stable',
          'title', 'Stable landing',
          'message',
            'The touchdown remained inside a solid operational range.',
          'evidence',
            jsonb_build_object('landingRate', v_pirep.landing_rate)
        )
      );
    elsif v_landing_abs <= 500 then
      v_score := v_score + 4;
      v_focus_items := v_focus_items || jsonb_build_array(
        jsonb_build_object(
          'code', 'landing_firm',
          'title', 'Refine the flare',
          'message',
            'The landing was firm. Review flare timing and vertical-speed control.',
          'evidence',
            jsonb_build_object('landingRate', v_pirep.landing_rate)
        )
      );
    else
      v_score := v_score - 16;
      v_focus_items := v_focus_items || jsonb_build_array(
        jsonb_build_object(
          'code', 'landing_hard',
          'title', 'Review touchdown technique',
          'message',
            'The recorded landing rate is outside the preferred range and deserves a focused review.',
          'evidence',
            jsonb_build_object('landingRate', v_pirep.landing_rate)
        )
      );
    end if;
  end if;

  if v_planned_block_minutes is not null
     and v_planned_block_minutes > 0 then
    v_evidence_points := v_evidence_points + 1;
    v_variance_minutes :=
      v_pirep.block_minutes - v_planned_block_minutes;
    v_variance_percent :=
      abs(v_variance_minutes)::numeric /
      v_planned_block_minutes::numeric * 100;

    if v_variance_percent <= 10 then
      v_score := v_score + 10;
      v_strengths := v_strengths || jsonb_build_array(
        jsonb_build_object(
          'code', 'block_time_precise',
          'title', 'Accurate operational timing',
          'message',
            'Actual block time remained close to the published plan.',
          'evidence',
            jsonb_build_object(
              'blockMinutes', v_pirep.block_minutes,
              'plannedBlockMinutes', v_planned_block_minutes,
              'varianceMinutes', v_variance_minutes
            )
        )
      );
    elsif v_variance_percent <= 25 then
      v_score := v_score + 5;
      v_strengths := v_strengths || jsonb_build_array(
        jsonb_build_object(
          'code', 'block_time_reasonable',
          'title', 'Reasonable block-time control',
          'message',
            'The flight remained within a reasonable timing variance.',
          'evidence',
            jsonb_build_object(
              'blockMinutes', v_pirep.block_minutes,
              'plannedBlockMinutes', v_planned_block_minutes,
              'varianceMinutes', v_variance_minutes
            )
        )
      );
    else
      v_score := v_score - 6;
      v_focus_items := v_focus_items || jsonb_build_array(
        jsonb_build_object(
          'code', 'block_time_variance',
          'title', 'Review flight timing',
          'message',
            'Actual block time differed materially from the route plan. Review taxi, cruise and turnaround timing.',
          'evidence',
            jsonb_build_object(
              'blockMinutes', v_pirep.block_minutes,
              'plannedBlockMinutes', v_planned_block_minutes,
              'varianceMinutes', v_variance_minutes,
              'variancePercent',
                round(v_variance_percent, 1)
            )
        )
      );
    end if;
  end if;

  if v_pirep.fuel_used_kg is not null then
    v_evidence_points := v_evidence_points + 1;
    v_strengths := v_strengths || jsonb_build_array(
      jsonb_build_object(
        'code', 'fuel_data_recorded',
        'title', 'Fuel data recorded',
        'message',
          'Fuel usage was captured, improving the quality of future operational comparisons.',
        'evidence',
          jsonb_build_object('fuelUsedKg', v_pirep.fuel_used_kg)
      )
    );
  else
    v_focus_items := v_focus_items || jsonb_build_array(
      jsonb_build_object(
        'code', 'fuel_data_missing',
        'title', 'Record fuel usage',
        'message',
          'Adding fuel-used data will make future debriefs more precise.',
        'evidence', jsonb_build_object('fuelUsedKg', null)
      )
    );
  end if;

  if v_replay_healthy is true then
    v_evidence_points := v_evidence_points + 1;
    v_score := v_score + 6;
    v_strengths := v_strengths || jsonb_build_array(
      jsonb_build_object(
        'code', 'replay_integrity_healthy',
        'title', 'Complete operational record',
        'message',
          'The flight event chain is complete and agrees with the operational projection.',
        'evidence', jsonb_build_object('replayHealthy', true)
      )
    );
  elsif v_replay_healthy is false then
    v_evidence_points := v_evidence_points + 1;
    v_score := v_score - 4;
    v_focus_items := v_focus_items || jsonb_build_array(
      jsonb_build_object(
        'code', 'replay_integrity_warning',
        'title', 'System record note',
        'message',
          'The flight record contains an integrity warning. This is an operational data note, not automatically a pilot-performance issue.',
        'evidence',
          jsonb_build_object(
            'replayHealthy', false,
            'integrity', v_replay_integrity
          )
      )
    );
  end if;

  if jsonb_array_length(v_focus_items) = 0 then
    v_focus_items := jsonb_build_array(
      jsonb_build_object(
        'code', 'consistency_next',
        'title', 'Repeat the standard',
        'message',
          'No major focus item was detected. Aim to reproduce the same stable result on the next flight.',
        'evidence', '{}'::jsonb
      )
    );
  end if;

  v_score := greatest(0, least(100, v_score));
  v_confidence := greatest(
    0.2,
    least(1, round((v_evidence_points::numeric / 5), 2))
  );

  v_headline := case
    when v_score >= 90 then 'Excellent operational performance'
    when v_score >= 80 then 'Strong and controlled flight'
    when v_score >= 65 then 'Flight complete with useful progress'
    else 'Focused review recommended'
  end;

  v_summary := case v_tone
    when 'direct' then
      case
        when v_score >= 85 then
          format(
            '%s met a strong operational standard. Preserve the same discipline.',
            v_pirep.flight_number
          )
        else
          format(
            '%s is complete. Review the focus items before the next flight.',
            v_pirep.flight_number
          )
      end
    when 'professional' then
      case
        when v_score >= 85 then
          format(
            '%s demonstrates a strong and consistent operational result.',
            v_pirep.flight_number
          )
        else
          format(
            '%s was completed successfully with clear areas for continued improvement.',
            v_pirep.flight_number
          )
      end
    else
      case
        when v_score >= 85 then
          format(
            'Well flown. %s shows calm, consistent progress you can build on.',
            v_pirep.flight_number
          )
        else
          format(
            'Flight complete. %s gives you useful experience, and the next improvement is already clear.',
            v_pirep.flight_number
          )
      end
  end;

  select id
  into v_debrief_id
  from public.flight_companion_debriefs
  where pirep_id = v_pirep.id;

  if v_debrief_id is null then
    insert into public.flight_companion_debriefs (
      pirep_id,
      booking_id,
      pilot_id,
      organization_id,
      flight_number,
      status,
      tone,
      overall_score,
      confidence,
      headline,
      summary,
      strengths,
      focus_items,
      metrics,
      replay_integrity,
      generated_at,
      updated_at
    )
    values (
      v_pirep.id,
      v_booking.id,
      v_pirep.pilot_id,
      'kalabsha-airlines',
      v_pirep.flight_number,
      'ready',
      v_tone,
      v_score,
      v_confidence,
      v_headline,
      v_summary,
      v_strengths,
      v_focus_items,
      jsonb_build_object(
        'blockMinutes', v_pirep.block_minutes,
        'plannedBlockMinutes', v_planned_block_minutes,
        'blockVarianceMinutes', v_variance_minutes,
        'blockVariancePercent',
          case
            when v_variance_percent is null then null
            else round(v_variance_percent, 1)
          end,
        'landingRate', v_pirep.landing_rate,
        'fuelUsedKg', v_pirep.fuel_used_kg,
        'pirepStatus', v_pirep.status
      ),
      v_replay_integrity,
      now(),
      now()
    )
    returning id into v_debrief_id;
  else
    update public.flight_companion_debriefs
    set
      tone = v_tone,
      overall_score = v_score,
      confidence = v_confidence,
      headline = v_headline,
      summary = v_summary,
      strengths = v_strengths,
      focus_items = v_focus_items,
      metrics = jsonb_build_object(
        'blockMinutes', v_pirep.block_minutes,
        'plannedBlockMinutes', v_planned_block_minutes,
        'blockVarianceMinutes', v_variance_minutes,
        'blockVariancePercent',
          case
            when v_variance_percent is null then null
            else round(v_variance_percent, 1)
          end,
        'landingRate', v_pirep.landing_rate,
        'fuelUsedKg', v_pirep.fuel_used_kg,
        'pirepStatus', v_pirep.status
      ),
      replay_integrity = v_replay_integrity,
      generated_at = now(),
      updated_at = now()
    where id = v_debrief_id;

    v_event_type := 'companion.debrief_regenerated';
  end if;

  perform public.append_domain_event(
    p_event_type => v_event_type,
    p_aggregate_type => 'flight_companion_debrief',
    p_aggregate_id => v_debrief_id::text,
    p_actor_id => v_pirep.pilot_id::text,
    p_organization_id => 'kalabsha-airlines',
    p_payload => jsonb_build_object(
      'debriefId', v_debrief_id,
      'bookingId', v_booking.id,
      'pirepId', v_pirep.id,
      'pilotId', v_pirep.pilot_id,
      'flightNumber', v_pirep.flight_number,
      'overallScore', v_score,
      'confidence', v_confidence,
      'tone', v_tone
    ),
    p_metadata => jsonb_build_object(
      'source', 'digital-flight-companion.v1',
      'privacy', 'pilot_private',
      'explainable', true
    )
  );

  return v_debrief_id;
end;
$$;

revoke all on function public.generate_flight_companion_debrief(uuid)
from public, anon, authenticated;

grant execute on function public.generate_flight_companion_debrief(uuid)
to service_role;

create or replace function public.handle_companion_pirep_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pirep_id uuid;
begin
  if new.event_type <> 'pirep.created' then
    return new;
  end if;

  begin
    v_pirep_id := nullif(new.payload ->> 'pirepId', '')::uuid;
  exception
    when invalid_text_representation then
      return new;
  end;

  if v_pirep_id is not null then
    perform public.generate_flight_companion_debrief(v_pirep_id);
  end if;

  return new;
end;
$$;

revoke all on function public.handle_companion_pirep_event()
from public, anon, authenticated;

drop trigger if exists zz_after_platform_event_companion_debrief
on public.platform_events;

create trigger zz_after_platform_event_companion_debrief
after insert on public.platform_events
for each row
when (new.event_type = 'pirep.created')
execute function public.handle_companion_pirep_event();

create or replace function public.update_companion_preferences(
  p_tone text,
  p_detail_level text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_tone not in ('supportive', 'professional', 'direct') then
    raise exception 'Invalid companion tone';
  end if;

  if p_detail_level not in ('concise', 'standard', 'detailed') then
    raise exception 'Invalid detail level';
  end if;

  insert into public.pilot_companion_preferences (
    pilot_id,
    tone,
    detail_level,
    updated_at
  )
  values (
    v_user_id,
    p_tone,
    p_detail_level,
    now()
  )
  on conflict (pilot_id)
  do update set
    tone = excluded.tone,
    detail_level = excluded.detail_level,
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.update_companion_preferences(text, text)
from public, anon;

grant execute on function public.update_companion_preferences(text, text)
to authenticated;

create or replace function public.acknowledge_companion_debrief(
  p_debrief_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_debrief public.flight_companion_debriefs%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_debrief
  from public.flight_companion_debriefs
  where id = p_debrief_id
    and pilot_id = v_user_id
  for update;

  if not found then
    raise exception 'Companion debrief not found';
  end if;

  update public.flight_companion_debriefs
  set
    status = 'acknowledged',
    acknowledged_at = coalesce(acknowledged_at, now()),
    updated_at = now()
  where id = p_debrief_id;

  perform public.append_domain_event(
    p_event_type => 'companion.debrief_acknowledged',
    p_aggregate_type => 'flight_companion_debrief',
    p_aggregate_id => p_debrief_id::text,
    p_actor_id => v_user_id::text,
    p_organization_id => v_debrief.organization_id,
    p_payload => jsonb_build_object(
      'debriefId', p_debrief_id,
      'bookingId', v_debrief.booking_id,
      'pirepId', v_debrief.pirep_id,
      'pilotId', v_user_id,
      'flightNumber', v_debrief.flight_number,
      'status', 'acknowledged'
    ),
    p_metadata => jsonb_build_object(
      'source', 'digital-flight-companion.pilot',
      'privacy', 'pilot_private'
    )
  );

  return true;
end;
$$;

revoke all on function public.acknowledge_companion_debrief(uuid)
from public, anon;

grant execute on function public.acknowledge_companion_debrief(uuid)
to authenticated;

-- Create preferences for existing pilots.
insert into public.pilot_companion_preferences (pilot_id)
select profile.id
from public.profiles profile
on conflict (pilot_id) do nothing;

-- Generate debriefs for existing flight reports.
do $$
declare
  v_record record;
begin
  for v_record in
    select id
    from public.pireps
    where booking_id is not null
    order by created_at, id
  loop
    perform public.generate_flight_companion_debrief(v_record.id);
  end loop;
end
$$;
