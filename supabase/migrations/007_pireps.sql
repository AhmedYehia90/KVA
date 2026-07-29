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
