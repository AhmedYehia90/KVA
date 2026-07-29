-- KVA v5.1: Flight operations foundation

create table if not exists public.flights (
  id uuid primary key default gen_random_uuid(),
  flight_number text not null unique,
  departure_airport_id uuid not null references public.airports(id),
  arrival_airport_id uuid not null references public.airports(id),
  fleet_type_id uuid not null references public.fleet_types(id),
  scheduled_departure time,
  scheduled_arrival time,
  block_minutes integer not null check (block_minutes > 0),
  distance_nm integer check (distance_nm is null or distance_nm > 0),
  days_of_week smallint[] not null default array[1,2,3,4,5,6,7],
  status text not null default 'available' check (
    status in ('draft', 'scheduled', 'available', 'suspended', 'cancelled')
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (departure_airport_id <> arrival_airport_id)
);

create table if not exists public.flight_bookings (
  id uuid primary key default gen_random_uuid(),
  flight_id uuid not null references public.flights(id) on delete restrict,
  pilot_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'booked' check (
    status in ('booked', 'boarding', 'departed', 'enroute', 'landed', 'completed', 'cancelled', 'expired')
  ),
  booked_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_flight_bookings_active_pilot
on public.flight_bookings(pilot_id)
where status in ('booked', 'boarding', 'departed', 'enroute', 'landed');

create index if not exists idx_flights_route
on public.flights(departure_airport_id, arrival_airport_id);

create index if not exists idx_flights_status
on public.flights(status) where is_active = true;

create index if not exists idx_flight_bookings_flight_id
on public.flight_bookings(flight_id);

create index if not exists idx_flight_bookings_pilot_id
on public.flight_bookings(pilot_id);

create table if not exists public.dispatches (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.flight_bookings(id) on delete cascade,
  dispatch_number text not null unique,
  route text,
  cruise_altitude integer check (cruise_altitude is null or cruise_altitude > 0),
  planned_fuel_kg integer check (planned_fuel_kg is null or planned_fuel_kg >= 0),
  alternate_airport_id uuid references public.airports(id),
  remarks text,
  released_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pilot_type_ratings (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references public.profiles(id) on delete cascade,
  fleet_type_id uuid not null references public.fleet_types(id) on delete cascade,
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (pilot_id, fleet_type_id),
  check (expires_at is null or expires_at > issued_at)
);

create index if not exists idx_pilot_type_ratings_pilot_id
on public.pilot_type_ratings(pilot_id);

create index if not exists idx_pilot_type_ratings_fleet_type_id
on public.pilot_type_ratings(fleet_type_id);

create sequence if not exists public.dispatch_number_seq start 1;

create or replace function public.assign_dispatch_number()
returns trigger
language plpgsql
as $$
begin
  if new.dispatch_number is null or btrim(new.dispatch_number) = '' then
    new.dispatch_number := 'DSP-' || to_char(current_date, 'YYYY') || '-' ||
      lpad(nextval('public.dispatch_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists before_dispatch_number on public.dispatches;
create trigger before_dispatch_number
before insert on public.dispatches
for each row execute function public.assign_dispatch_number();

drop trigger if exists flights_updated_at on public.flights;
create trigger flights_updated_at
before update on public.flights
for each row execute function public.set_updated_at();

drop trigger if exists flight_bookings_updated_at on public.flight_bookings;
create trigger flight_bookings_updated_at
before update on public.flight_bookings
for each row execute function public.set_updated_at();

drop trigger if exists dispatches_updated_at on public.dispatches;
create trigger dispatches_updated_at
before update on public.dispatches
for each row execute function public.set_updated_at();

alter table public.flights enable row level security;
alter table public.flight_bookings enable row level security;
alter table public.dispatches enable row level security;
alter table public.pilot_type_ratings enable row level security;

drop policy if exists flights_authenticated_read on public.flights;
create policy flights_authenticated_read
on public.flights for select
to authenticated
using (is_active = true);

drop policy if exists bookings_select_own on public.flight_bookings;
create policy bookings_select_own
on public.flight_bookings for select
to authenticated
using (pilot_id = auth.uid());

drop policy if exists bookings_insert_own on public.flight_bookings;
create policy bookings_insert_own
on public.flight_bookings for insert
to authenticated
with check (pilot_id = auth.uid());

drop policy if exists bookings_update_own on public.flight_bookings;
create policy bookings_update_own
on public.flight_bookings for update
to authenticated
using (pilot_id = auth.uid())
with check (pilot_id = auth.uid());

drop policy if exists dispatches_select_own on public.dispatches;
create policy dispatches_select_own
on public.dispatches for select
to authenticated
using (
  exists (
    select 1
    from public.flight_bookings booking
    where booking.id = dispatches.booking_id
      and booking.pilot_id = auth.uid()
  )
);

drop policy if exists type_ratings_select_own on public.pilot_type_ratings;
create policy type_ratings_select_own
on public.pilot_type_ratings for select
to authenticated
using (pilot_id = auth.uid());
