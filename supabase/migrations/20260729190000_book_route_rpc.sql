-- KVA v5.1: transactional route booking RPC

create or replace function public.book_route(p_route_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pilot_id uuid := auth.uid();
  v_route public.routes%rowtype;
  v_booking_id uuid;
  v_aircraft_id uuid;
begin
  if v_pilot_id is null then
    raise exception 'Authentication required';
  end if;

  -- Serialize booking attempts for the same pilot.
  perform pg_advisory_xact_lock(hashtext(v_pilot_id::text));

  select *
  into v_route
  from public.routes
  where id = p_route_id
    and active = true;

  if not found then
    raise exception 'The selected route is unavailable';
  end if;

  if exists (
    select 1
    from public.flight_bookings
    where pilot_id = v_pilot_id
      and status in ('booked', 'boarding', 'departed', 'enroute', 'landed')
  ) then
    raise exception 'You already have an active flight booking';
  end if;

  -- Prefer an available aircraft of the scheduled fleet type.
  select aircraft.id
  into v_aircraft_id
  from public.aircraft
  where aircraft.fleet_type_id = v_route.fleet_type_id
    and aircraft.status = 'active'
    and not exists (
      select 1
      from public.flight_bookings booking
      where booking.aircraft_id = aircraft.id
        and booking.status in (
          'booked',
          'boarding',
          'departed',
          'enroute',
          'landed'
        )
    )
  order by aircraft.registration
  limit 1
  for update skip locked;

  insert into public.flight_bookings (
    route_id,
    pilot_id,
    aircraft_id,
    status
  )
  values (
    v_route.id,
    v_pilot_id,
    v_aircraft_id,
    'booked'
  )
  returning id into v_booking_id;

  insert into public.dispatches (
    booking_id,
    dispatch_number,
    route,
    remarks
  )
  values (
    v_booking_id,
    null,
    v_route.flight_number,
    case
      when v_aircraft_id is null
        then 'Aircraft assignment pending.'
      else 'Dispatch generated automatically.'
    end
  );

  return v_booking_id;
end;
$$;

revoke all on function public.book_route(uuid) from public;
grant execute on function public.book_route(uuid) to authenticated;
