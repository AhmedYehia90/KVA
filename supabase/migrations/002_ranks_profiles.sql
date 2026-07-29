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
