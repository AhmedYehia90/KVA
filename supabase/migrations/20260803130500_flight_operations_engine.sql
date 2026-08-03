-- KVA v6.0: flight operations state machine and event log

alter table public.flight_bookings
add column if not exists operation_phase text not null default 'boarding';

alter table public.flight_bookings
drop constraint if exists flight_bookings_operation_phase_check;

alter table public.flight_bookings
add constraint flight_bookings_operation_phase_check
check (operation_phase in ('boarding','pushback','taxi','takeoff','climb','cruise','descent','landing','arrived','completed'));

create table if not exists public.flight_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.flight_bookings(id) on delete cascade,
  event text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_flight_events_booking_created
on public.flight_events(booking_id, created_at);

alter table public.flight_events enable row level security;

drop policy if exists "Pilots can view own flight events" on public.flight_events;
create policy "Pilots can view own flight events"
on public.flight_events for select to authenticated
using (
  exists (
    select 1 from public.flight_bookings booking
    where booking.id = flight_events.booking_id
      and booking.pilot_id = auth.uid()
  )
);

create or replace function public.advance_flight_operation(p_booking_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pilot_id uuid := auth.uid();
  v_phase text;
  v_next_phase text;
  v_aircraft_id uuid;
begin
  if v_pilot_id is null then
    raise exception 'Authentication required';
  end if;

  select operation_phase, aircraft_id
  into v_phase, v_aircraft_id
  from public.flight_bookings
  where id = p_booking_id and pilot_id = v_pilot_id
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;

  v_next_phase := case v_phase
    when 'boarding' then 'pushback'
    when 'pushback' then 'taxi'
    when 'taxi' then 'takeoff'
    when 'takeoff' then 'climb'
    when 'climb' then 'cruise'
    when 'cruise' then 'descent'
    when 'descent' then 'landing'
    when 'landing' then 'arrived'
    when 'arrived' then 'completed'
    else null
  end;

  if v_next_phase is null then
    return v_phase;
  end if;

  update public.flight_bookings
  set
    operation_phase = v_next_phase,
    status = case
      when v_next_phase in ('pushback','taxi') then 'boarding'::public.flight_status
      when v_next_phase in ('takeoff','climb','cruise','descent') then 'enroute'::public.flight_status
      when v_next_phase in ('landing','arrived') then 'landed'::public.flight_status
      when v_next_phase = 'completed' then 'completed'::public.flight_status
      else status
    end,
    started_at = case when v_phase = 'boarding' and started_at is null then now() else started_at end,
    completed_at = case when v_next_phase = 'completed' then now() else completed_at end
  where id = p_booking_id;

  insert into public.flight_events (booking_id, event, created_by)
  values (p_booking_id, upper(v_next_phase), v_pilot_id);

  if v_aircraft_id is not null and v_next_phase = 'completed' then
    update public.aircraft set status = 'active'::public.aircraft_status where id = v_aircraft_id;
  end if;

  return v_next_phase;
end;
$$;

revoke all on function public.advance_flight_operation(uuid) from public;
grant execute on function public.advance_flight_operation(uuid) to authenticated;

insert into public.flight_events (booking_id, event, created_by)
select booking.id, upper(booking.operation_phase), booking.pilot_id
from public.flight_bookings booking
where not exists (
  select 1 from public.flight_events event where event.booking_id = booking.id
);
