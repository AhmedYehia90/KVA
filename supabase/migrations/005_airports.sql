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
