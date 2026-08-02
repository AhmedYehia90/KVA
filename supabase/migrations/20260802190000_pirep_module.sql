-- KVA PIREP module: link completed bookings and submit atomically

alter table public.pireps
add column if not exists booking_id uuid
references public.flight_bookings(id)
on delete set null;

create unique index if not exists uq_pireps_booking_id
on public.pireps(booking_id)
where booking_id is not null;

alter table public.pireps enable row level security;

drop policy if exists pireps_select_own on public.pireps;
create policy pireps_select_own
on public.pireps for select
to authenticated
using (pilot_id = auth.uid());

drop policy if exists pireps_insert_own on public.pireps;
create policy pireps_insert_own
on public.pireps for insert
to authenticated
with check (pilot_id = auth.uid());

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
    select 1 from public.pireps where booking_id = p_booking_id
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
    total_hours = coalesce(total_hours, 0) + (p_block_minutes::numeric / 60.0)
  where id = v_user_id;

  return v_pirep_id;
end;
$$;

revoke all on function public.submit_booking_pirep(uuid, integer, integer, numeric, text) from public;
grant execute on function public.submit_booking_pirep(uuid, integer, integer, numeric, text) to authenticated;
