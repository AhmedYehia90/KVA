create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'aircraft_status') then
    create type public.aircraft_status as enum ('active','maintenance','grounded','retired');
  end if;
  if not exists (select 1 from pg_type where typname = 'route_status') then
    create type public.route_status as enum ('active','inactive');
  end if;
  if not exists (select 1 from pg_type where typname = 'pirep_status') then
    create type public.pirep_status as enum ('draft','submitted','approved','rejected');
  end if;
end $$;

create table if not exists public.ranks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  minimum_hours numeric(10,2) not null default 0,
  minimum_flights integer not null default 0,
  badge_url text,
  priority integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists rank_id uuid references public.ranks(id),
  add column if not exists email text,
  add column if not exists last_flight_at timestamptz,
  add column if not exists avatar_url text;

create table if not exists public.fleet_types (
  id uuid primary key default gen_random_uuid(),
  icao_code text not null unique,
  manufacturer text not null,
  model text not null,
  engine_count integer not null,
  engine_type text,
  range_nm integer,
  cruise_speed_kts integer,
  max_passengers integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.airports (
  id uuid primary key default gen_random_uuid(),
  icao_code text not null unique,
  iata_code text,
  name text not null,
  city text not null,
  country text not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  timezone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.aircraft
  add column if not exists fleet_type_id uuid references public.fleet_types(id),
  add column if not exists current_airport_id uuid references public.airports(id),
  add column if not exists flight_hours numeric(12,2) not null default 0,
  add column if not exists assigned_pilot_id uuid references public.profiles(id),
  add column if not exists livery_version text not null default '1.0';

create table if not exists public.flights (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references public.profiles(id),
  aircraft_id uuid references public.aircraft(id),
  route_id uuid references public.routes(id),
  flight_number text not null,
  departure_icao text not null,
  arrival_icao text not null,
  scheduled_departure timestamptz,
  actual_departure timestamptz,
  actual_arrival timestamptz,
  status text not null default 'planned',
  created_at timestamptz not null default now()
);

create table if not exists public.awards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  icon_url text,
  requirements jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.pilot_awards (
  pilot_id uuid not null references public.profiles(id) on delete cascade,
  award_id uuid not null references public.awards(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  awarded_by uuid references public.profiles(id),
  primary key (pilot_id, award_id)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reward jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.ranks enable row level security;
alter table public.fleet_types enable row level security;
alter table public.airports enable row level security;
alter table public.flights enable row level security;
alter table public.awards enable row level security;
alter table public.pilot_awards enable row level security;
alter table public.events enable row level security;

create policy "Public can read ranks" on public.ranks for select using (true);
create policy "Public can read fleet types" on public.fleet_types for select using (active = true);
create policy "Public can read airports" on public.airports for select using (active = true);
create policy "Pilots can read own flights" on public.flights for select using (auth.uid() = pilot_id);
create policy "Pilots can create own flights" on public.flights for insert with check (auth.uid() = pilot_id);
create policy "Public can read awards" on public.awards for select using (true);
create policy "Pilots can read own awards" on public.pilot_awards for select using (auth.uid() = pilot_id);
create policy "Public can read active events" on public.events for select using (active = true);
