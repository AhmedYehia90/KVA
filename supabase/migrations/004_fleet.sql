create table if not exists public.fleet_types (
  id uuid primary key default gen_random_uuid(),
  icao_code text not null unique,
  manufacturer text not null,
  model text not null,
  engine_count integer not null check (engine_count > 0),
  engine_type text,
  range_nm integer check (range_nm is null or range_nm > 0),
  cruise_speed_kts integer check (cruise_speed_kts is null or cruise_speed_kts > 0),
  max_passengers integer check (max_passengers is null or max_passengers >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aircraft (
  id uuid primary key default gen_random_uuid(),
  registration text not null unique,
  fleet_type_id uuid not null references public.fleet_types(id),
  status public.aircraft_status not null default 'active',
  current_airport_id uuid,
  flight_hours numeric(12,2) not null default 0 check (flight_hours >= 0),
  assigned_pilot_id uuid references public.profiles(id),
  livery_version text not null default '1.0',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists fleet_types_updated_at on public.fleet_types;
create trigger fleet_types_updated_at before update on public.fleet_types
for each row execute function public.set_updated_at();

drop trigger if exists aircraft_updated_at on public.aircraft;
create trigger aircraft_updated_at before update on public.aircraft
for each row execute function public.set_updated_at();

create index if not exists idx_aircraft_fleet_type_id on public.aircraft(fleet_type_id);
create index if not exists idx_aircraft_status on public.aircraft(status);
