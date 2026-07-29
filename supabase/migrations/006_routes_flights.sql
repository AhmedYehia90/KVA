create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  flight_number text not null unique,
  departure_airport_id uuid not null references public.airports(id),
  arrival_airport_id uuid not null references public.airports(id),
  fleet_type_id uuid not null references public.fleet_types(id),
  scheduled_minutes integer check (scheduled_minutes is null or scheduled_minutes > 0),
  distance_nm integer check (distance_nm is null or distance_nm > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (departure_airport_id <> arrival_airport_id)
);

create table if not exists public.flights (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references public.profiles(id),
  aircraft_id uuid references public.aircraft(id),
  route_id uuid references public.routes(id),
  flight_number text not null,
  departure_airport_id uuid not null references public.airports(id),
  arrival_airport_id uuid not null references public.airports(id),
  scheduled_departure timestamptz,
  actual_departure timestamptz,
  actual_arrival timestamptz,
  status public.flight_status not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (departure_airport_id <> arrival_airport_id)
);

drop trigger if exists routes_updated_at on public.routes;
create trigger routes_updated_at before update on public.routes
for each row execute function public.set_updated_at();

drop trigger if exists flights_updated_at on public.flights;
create trigger flights_updated_at before update on public.flights
for each row execute function public.set_updated_at();

create index if not exists idx_routes_departure on public.routes(departure_airport_id);
create index if not exists idx_routes_arrival on public.routes(arrival_airport_id);
create index if not exists idx_flights_pilot on public.flights(pilot_id);
create index if not exists idx_flights_status on public.flights(status);
