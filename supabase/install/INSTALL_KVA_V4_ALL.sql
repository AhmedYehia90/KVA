create extension if not exists pgcrypto;

create sequence if not exists public.pilot_number_seq
  as bigint start with 1 increment by 1 minvalue 1;

create sequence if not exists public.pirep_number_seq
  as bigint start with 1 increment by 1 minvalue 1;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;



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



create table if not exists public.ranks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  minimum_hours numeric(10,2) not null default 0 check (minimum_hours >= 0),
  minimum_flights integer not null default 0 check (minimum_flights >= 0),
  badge_url text,
  priority integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  pilot_number bigint not null unique,
  callsign text not null unique,
  full_name text not null,
  email text,
  country_code text,
  role public.user_role not null default 'pilot',
  status public.pilot_status not null default 'pending',
  rank_id uuid references public.ranks(id),
  total_hours numeric(12,2) not null default 0 check (total_hours >= 0),
  total_flights integer not null default 0 check (total_flights >= 0),
  avatar_url text,
  last_flight_at timestamptz,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.assign_profile_identity()
returns trigger
language plpgsql
as $$
begin
  if new.pilot_number is null then
    new.pilot_number := nextval('public.pilot_number_seq');
  end if;

  if new.callsign is null or btrim(new.callsign) = '' then
    new.callsign := 'KVA-P' || lpad(new.pilot_number::text, 3, '0');
  end if;

  return new;
end;
$$;

drop trigger if exists before_profile_identity on public.profiles;
create trigger before_profile_identity
before insert on public.profiles
for each row execute function public.assign_profile_identity();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create index if not exists idx_profiles_rank_id on public.profiles(rank_id);
create index if not exists idx_profiles_status on public.profiles(status);



create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_rank_id uuid;
begin
  select id into default_rank_id
  from public.ranks
  where code = 'CADET'
  limit 1;

  insert into public.profiles (
    id,
    pilot_number,
    callsign,
    full_name,
    email,
    rank_id
  )
  values (
    new.id,
    null,
    null,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    default_rank_id
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();



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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.aircraft
  drop constraint if exists aircraft_current_airport_id_fkey;

alter table public.aircraft
  add constraint aircraft_current_airport_id_fkey
  foreign key (current_airport_id) references public.airports(id);

drop trigger if exists airports_updated_at on public.airports;
create trigger airports_updated_at before update on public.airports
for each row execute function public.set_updated_at();



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



create table if not exists public.pireps (
  id uuid primary key default gen_random_uuid(),
  pirep_number bigint not null unique,
  pirep_code text not null unique,
  flight_id uuid references public.flights(id),
  pilot_id uuid not null references public.profiles(id),
  flight_number text not null,
  departure_airport_id uuid not null references public.airports(id),
  arrival_airport_id uuid not null references public.airports(id),
  aircraft_id uuid references public.aircraft(id),
  block_minutes integer not null check (block_minutes > 0),
  landing_rate integer,
  fuel_used_kg numeric(12,2) check (fuel_used_kg is null or fuel_used_kg >= 0),
  status public.pirep_status not null default 'submitted',
  remarks text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.assign_pirep_code()
returns trigger
language plpgsql
as $$
begin
  if new.pirep_number is null then
    new.pirep_number := nextval('public.pirep_number_seq');
  end if;

  if new.pirep_code is null or btrim(new.pirep_code) = '' then
    new.pirep_code :=
      'PR-' ||
      extract(year from coalesce(new.created_at, now()))::integer::text ||
      '-' ||
      lpad(new.pirep_number::text, 6, '0');
  end if;

  return new;
end;
$$;

drop trigger if exists before_pirep_identity on public.pireps;
create trigger before_pirep_identity
before insert on public.pireps
for each row execute function public.assign_pirep_code();

drop trigger if exists pireps_updated_at on public.pireps;
create trigger pireps_updated_at before update on public.pireps
for each row execute function public.set_updated_at();

create index if not exists idx_pireps_pilot on public.pireps(pilot_id);
create index if not exists idx_pireps_status on public.pireps(status);



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
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

drop trigger if exists events_updated_at on public.events;
create trigger events_updated_at before update on public.events
for each row execute function public.set_updated_at();



create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('dispatcher', 'staff', 'admin')
      and status = 'active'
  );
$$;

alter table public.ranks enable row level security;
alter table public.profiles enable row level security;
alter table public.fleet_types enable row level security;
alter table public.aircraft enable row level security;
alter table public.airports enable row level security;
alter table public.routes enable row level security;
alter table public.flights enable row level security;
alter table public.pireps enable row level security;
alter table public.awards enable row level security;
alter table public.pilot_awards enable row level security;
alter table public.events enable row level security;

create policy "Public read ranks" on public.ranks for select using (true);
create policy "Public read fleet types" on public.fleet_types for select using (active);
create policy "Public read airports" on public.airports for select using (active);
create policy "Public read routes" on public.routes for select using (active);
create policy "Public read awards" on public.awards for select using (true);
create policy "Public read events" on public.events for select using (active);

create policy "Read own profile or staff" on public.profiles
for select using (auth.uid() = id or public.is_staff());

create policy "Update own profile or staff" on public.profiles
for update using (auth.uid() = id or public.is_staff())
with check (auth.uid() = id or public.is_staff());

create policy "Authenticated read aircraft" on public.aircraft
for select to authenticated using (true);

create policy "Staff manage aircraft" on public.aircraft
for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "Pilot read own flights or staff" on public.flights
for select using (auth.uid() = pilot_id or public.is_staff());

create policy "Pilot create own flights" on public.flights
for insert with check (auth.uid() = pilot_id);

create policy "Staff manage flights" on public.flights
for all using (public.is_staff()) with check (public.is_staff());

create policy "Pilot read own pireps or staff" on public.pireps
for select using (auth.uid() = pilot_id or public.is_staff());

create policy "Pilot submit own pireps" on public.pireps
for insert with check (auth.uid() = pilot_id);

create policy "Staff manage pireps" on public.pireps
for all using (public.is_staff()) with check (public.is_staff());

create policy "Pilot read own awards or staff" on public.pilot_awards
for select using (auth.uid() = pilot_id or public.is_staff());

create policy "Staff manage pilot awards" on public.pilot_awards
for all using (public.is_staff()) with check (public.is_staff());



insert into public.ranks (code, name, minimum_hours, minimum_flights, priority)
values
  ('CADET', 'Cadet', 0, 0, 10),
  ('SO', 'Second Officer', 25, 10, 20),
  ('FO', 'First Officer', 100, 40, 30),
  ('SFO', 'Senior First Officer', 250, 100, 40),
  ('CPT', 'Captain', 500, 200, 50),
  ('SCPT', 'Senior Captain', 1000, 400, 60),
  ('CP', 'Chief Pilot', 2000, 750, 70)
on conflict (code) do update set
  name = excluded.name,
  minimum_hours = excluded.minimum_hours,
  minimum_flights = excluded.minimum_flights,
  priority = excluded.priority;

insert into public.fleet_types
(icao_code, manufacturer, model, engine_count, engine_type, range_nm, cruise_speed_kts, max_passengers)
values
  ('E170', 'Embraer', 'Embraer 170', 2, 'Turbofan', 2150, 470, 78),
  ('A21N', 'Airbus', 'Airbus A321neo', 2, 'Turbofan', 4000, 450, 244),
  ('A359', 'Airbus', 'Airbus A350-900', 2, 'Turbofan', 8100, 488, 440),
  ('B788', 'Boeing', 'Boeing 787-8', 2, 'Turbofan', 7355, 488, 248),
  ('B77W', 'Boeing', 'Boeing 777-300ER', 2, 'Turbofan', 7370, 490, 396),
  ('B748', 'Boeing', 'Boeing 747-8', 4, 'Turbofan', 7730, 493, 467)
on conflict (icao_code) do update set
  manufacturer = excluded.manufacturer,
  model = excluded.model,
  engine_count = excluded.engine_count,
  engine_type = excluded.engine_type,
  range_nm = excluded.range_nm,
  cruise_speed_kts = excluded.cruise_speed_kts,
  max_passengers = excluded.max_passengers;

insert into public.airports
(icao_code, iata_code, name, city, country, latitude, longitude, timezone)
values
  ('HECA', 'CAI', 'Cairo International Airport', 'Cairo', 'Egypt', 30.121944, 31.405556, 'Africa/Cairo'),
  ('OMDB', 'DXB', 'Dubai International Airport', 'Dubai', 'United Arab Emirates', 25.252778, 55.364444, 'Asia/Dubai'),
  ('OKKK', 'KWI', 'Kuwait International Airport', 'Kuwait City', 'Kuwait', 29.226567, 47.968928, 'Asia/Kuwait'),
  ('OEJN', 'JED', 'King Abdulaziz International Airport', 'Jeddah', 'Saudi Arabia', 21.679564, 39.156536, 'Asia/Riyadh'),
  ('LTFM', 'IST', 'Istanbul Airport', 'Istanbul', 'Türkiye', 41.275278, 28.751944, 'Europe/Istanbul')
on conflict (icao_code) do update set
  iata_code = excluded.iata_code,
  name = excluded.name,
  city = excluded.city,
  country = excluded.country,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  timezone = excluded.timezone;

insert into public.awards (code, name, description, requirements)
values
  ('FIRST_FLIGHT', 'First Flight', 'Awarded after the first approved PIREP.', '{"approved_pireps":1}'),
  ('TEN_FLIGHTS', '10 Flights', 'Awarded after ten approved PIREPs.', '{"approved_pireps":10}'),
  ('100_HOURS', '100 Flight Hours', 'Awarded after reaching 100 approved flight hours.', '{"flight_hours":100}')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  requirements = excluded.requirements;
