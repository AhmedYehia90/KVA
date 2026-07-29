do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('pilot', 'dispatcher', 'staff', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'pilot_status') then
    create type public.pilot_status as enum ('pending', 'active', 'suspended', 'retired');
  end if;

  if not exists (select 1 from pg_type where typname = 'aircraft_status') then
    create type public.aircraft_status as enum ('active', 'maintenance', 'grounded', 'retired');
  end if;

  if not exists (select 1 from pg_type where typname = 'flight_status') then
    create type public.flight_status as enum ('planned', 'booked', 'boarding', 'enroute', 'landed', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'pirep_status') then
    create type public.pirep_status as enum ('draft', 'submitted', 'approved', 'rejected');
  end if;
end $$;
