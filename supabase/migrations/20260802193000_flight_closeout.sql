-- KVA Flight Closeout
-- In the current schema, aircraft.status = 'active' means operational and available.
-- This migration closes completed bookings after PIREP submission and releases aircraft.

-- Allow the historical/closed booking state.
alter table public.flight_bookings
drop constraint if exists flight_bookings_status_check;

alter table public.flight_bookings
add constraint flight_bookings_status_check
check (
  status in (
    'booked',
    'boarding',
    'departed',
    'enroute',
    'landed',
    'completed',
    'closed',
    'cancelled',
    'expired'
  )
);

create or replace function public.submit_booking_pirep(
  p_booking_id uuid,
  p_block_minutes integer,
  p_landing_rate integer default null,
  p_fuel_used_kg numeric default null,
  p_remarks text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.flight_bookings%rowtype;
  v_route public.routes%rowtype;
  v_pirep_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_block_minutes is null or p_block_minutes <= 0 then
    raise exception 'Block time must be greater than zero';
  end if;

  select *
  into v_booking
  from public.flight_bookings
  where id = p_booking_id
    and pilot_id = v_user_id
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.status <> 'completed' then
    raise exception 'Flight must be completed before submitting a PIREP';
  end if;

  if exists (
    select 1
    from public.pireps
    where booking_id = p_booking_id
  ) then
    raise exception 'A PIREP already exists for this booking';
  end if;

  select *
  into v_route
  from public.routes
  where id = v_booking.route_id;

  if not found then
    raise exception 'Route not found';
  end if;

  insert into public.pireps (
    pirep_number,
    pirep_code,
    booking_id,
    pilot_id,
    flight_number,
    departure_airport_id,
    arrival_airport_id,
    aircraft_id,
    block_minutes,
    landing_rate,
    fuel_used_kg,
    status,
    remarks
  )
  values (
    nextval('public.pirep_number_seq'),
    '',
    v_booking.id,
    v_user_id,
    v_route.flight_number,
    v_route.departure_airport_id,
    v_route.arrival_airport_id,
    v_booking.aircraft_id,
    p_block_minutes,
    p_landing_rate,
    p_fuel_used_kg,
    'submitted',
    nullif(btrim(p_remarks), '')
  )
  returning id into v_pirep_id;

  update public.profiles
  set
    total_flights = coalesce(total_flights, 0) + 1,
    total_hours = coalesce(total_hours, 0) +
      (p_block_minutes::numeric / 60.0)
  where id = v_user_id;

  -- Close the booking so it is historical and no longer active.
  update public.flight_bookings
  set
    status = 'closed',
    completed_at = coalesce(completed_at, now())
  where id = v_booking.id;

  -- In this project, 'active' is the operational/available aircraft state.
  update public.aircraft
  set
    status = 'active',
    assigned_pilot_id = null
  where id = v_booking.aircraft_id;

  return v_pirep_id;
end;
$$;

revoke all on function public.submit_booking_pirep(
  uuid,
  integer,
  integer,
  numeric,
  text
) from public;

grant execute on function public.submit_booking_pirep(
  uuid,
  integer,
  integer,
  numeric,
  text
) to authenticated;

-- Repair already-submitted PIREPs created before this closeout migration.
update public.flight_bookings booking
set status = 'closed'
where booking.status = 'completed'
  and exists (
    select 1
    from public.pireps pirep
    where pirep.booking_id = booking.id
      and pirep.status in ('submitted', 'approved')
  );

update public.aircraft aircraft
set
  status = 'active',
  assigned_pilot_id = null
where exists (
  select 1
  from public.flight_bookings booking
  join public.pireps pirep
    on pirep.booking_id = booking.id
  where booking.aircraft_id = aircraft.id
    and booking.status = 'closed'
    and pirep.status in ('submitted', 'approved')
);
