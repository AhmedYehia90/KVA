-- KVA Universal Pilot Passport Pack v1.0

create table if not exists public.platform_organizations (
  id text primary key,
  code text not null unique,
  name text not null,
  slug text not null unique,
  organization_type text not null default 'virtual_airline' check (
    organization_type in ('virtual_airline', 'training', 'network')
  ),
  status text not null default 'active' check (
    status in ('pending', 'active', 'suspended', 'archived')
  ),
  is_founder boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.platform_organizations (
  id, code, name, slug, organization_type, status, is_founder
)
values (
  'kalabsha-airlines',
  'KVA',
  'Kalabsha Airlines',
  'kalabsha-airlines',
  'virtual_airline',
  'active',
  true
)
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  slug = excluded.slug,
  status = excluded.status,
  is_founder = excluded.is_founder,
  updated_at = now();

alter table public.platform_organizations enable row level security;

drop policy if exists platform_organizations_read
on public.platform_organizations;

create policy platform_organizations_read
on public.platform_organizations
for select
to anon, authenticated
using (status = 'active');

create table if not exists public.pilot_passports (
  pilot_id uuid primary key
    references public.profiles(id) on delete cascade,
  passport_number text not null unique,
  public_slug text not null unique,
  visibility text not null default 'private' check (
    visibility in ('private', 'network', 'public')
  ),
  status text not null default 'active' check (
    status in ('active', 'suspended', 'retired')
  ),
  bio text,
  issued_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pilot_passports enable row level security;

drop policy if exists pilot_passports_select_own
on public.pilot_passports;

create policy pilot_passports_select_own
on public.pilot_passports
for select
to authenticated
using (pilot_id = auth.uid());

drop policy if exists pilot_passports_update_own
on public.pilot_passports;

create policy pilot_passports_update_own
on public.pilot_passports
for update
to authenticated
using (pilot_id = auth.uid())
with check (pilot_id = auth.uid());

create table if not exists public.pilot_airline_memberships (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null
    references public.profiles(id) on delete cascade,
  organization_id text not null
    references public.platform_organizations(id) on delete cascade,
  callsign text,
  employee_number text,
  role text not null default 'pilot' check (
    role in ('pilot', 'instructor', 'dispatcher', 'manager', 'admin')
  ),
  status text not null default 'active' check (
    status in ('invited', 'active', 'inactive', 'left')
  ),
  is_primary boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pilot_id, organization_id)
);

create unique index if not exists uq_primary_airline_membership
on public.pilot_airline_memberships(pilot_id)
where is_primary = true and status = 'active';

create unique index if not exists uq_airline_employee_number
on public.pilot_airline_memberships(organization_id, employee_number)
where employee_number is not null;

alter table public.pilot_airline_memberships enable row level security;

drop policy if exists pilot_memberships_select_own
on public.pilot_airline_memberships;

create policy pilot_memberships_select_own
on public.pilot_airline_memberships
for select
to authenticated
using (pilot_id = auth.uid());

create table if not exists public.pilot_qualifications (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null
    references public.profiles(id) on delete cascade,
  organization_id text
    references public.platform_organizations(id) on delete set null,
  fleet_type_id uuid
    references public.fleet_types(id) on delete set null,
  qualification_code text not null,
  qualification_name text not null,
  status text not null default 'active' check (
    status in ('pending', 'active', 'expired', 'revoked')
  ),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  verified_at timestamptz,
  verification_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pilot_id, qualification_code, organization_id)
);

alter table public.pilot_qualifications enable row level security;

drop policy if exists pilot_qualifications_select_own
on public.pilot_qualifications;

create policy pilot_qualifications_select_own
on public.pilot_qualifications
for select
to authenticated
using (pilot_id = auth.uid());

create table if not exists public.pilot_experience_ledger (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null
    references public.profiles(id) on delete cascade,
  organization_id text not null default 'kalabsha-airlines'
    references public.platform_organizations(id) on delete restrict,
  source_pirep_id uuid not null unique
    references public.pireps(id) on delete cascade,
  booking_id uuid
    references public.flight_bookings(id) on delete set null,
  flight_number text not null,
  aircraft_id uuid
    references public.aircraft(id) on delete set null,
  departure_airport_id uuid not null
    references public.airports(id) on delete restrict,
  arrival_airport_id uuid not null
    references public.airports(id) on delete restrict,
  block_minutes integer not null check (block_minutes > 0),
  pirep_status text not null,
  flown_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_passport_experience_pilot_flown
on public.pilot_experience_ledger(pilot_id, flown_at desc);

create index if not exists idx_passport_experience_org
on public.pilot_experience_ledger(organization_id, flown_at desc);

alter table public.pilot_experience_ledger enable row level security;

drop policy if exists pilot_experience_select_own
on public.pilot_experience_ledger;

create policy pilot_experience_select_own
on public.pilot_experience_ledger
for select
to authenticated
using (pilot_id = auth.uid());

create or replace function public.ensure_pilot_passport(
  p_pilot_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_rows integer := 0;
begin
  select *
  into v_profile
  from public.profiles
  where id = p_pilot_id;

  if not found then
    raise exception 'Pilot profile not found';
  end if;

  insert into public.pilot_passports (
    pilot_id,
    passport_number,
    public_slug,
    visibility,
    status
  )
  values (
    v_profile.id,
    'UPP-' || upper(replace(v_profile.id::text, '-', '')),
    lower(
      regexp_replace(
        coalesce(nullif(v_profile.callsign, ''), 'pilot'),
        '[^a-zA-Z0-9]+',
        '-',
        'g'
      )
    ) || '-' || substr(replace(v_profile.id::text, '-', ''), 1, 8),
    'private',
    'active'
  )
  on conflict (pilot_id) do nothing;

  get diagnostics v_rows = row_count;

  insert into public.pilot_airline_memberships (
    pilot_id,
    organization_id,
    callsign,
    employee_number,
    role,
    status,
    is_primary
  )
  values (
    v_profile.id,
    'kalabsha-airlines',
    v_profile.callsign,
    v_profile.callsign,
    'pilot',
    'active',
    true
  )
  on conflict (pilot_id, organization_id)
  do update set
    callsign = excluded.callsign,
    employee_number = coalesce(
      public.pilot_airline_memberships.employee_number,
      excluded.employee_number
    ),
    status = case
      when public.pilot_airline_memberships.status = 'left'
        then public.pilot_airline_memberships.status
      else 'active'
    end,
    updated_at = now();

  if v_rows > 0 then
    perform public.append_domain_event(
      p_event_type => 'passport.issued',
      p_aggregate_type => 'pilot_passport',
      p_aggregate_id => v_profile.id::text,
      p_actor_id => v_profile.id::text,
      p_organization_id => 'kalabsha-airlines',
      p_payload => jsonb_build_object(
        'pilotId', v_profile.id,
        'passportNumber',
          'UPP-' || upper(replace(v_profile.id::text, '-', '')),
        'visibility', 'private',
        'status', 'active'
      ),
      p_metadata => jsonb_build_object(
        'source', 'upp.ensure_pilot_passport',
        'privacy', 'restricted'
      )
    );
  end if;

  return v_profile.id;
end;
$$;

revoke all on function public.ensure_pilot_passport(uuid)
from public, anon, authenticated;
grant execute on function public.ensure_pilot_passport(uuid)
to service_role;

create or replace function public.handle_profile_passport_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_pilot_passport(new.id);
  return new;
end;
$$;

drop trigger if exists after_profile_create_passport
on public.profiles;

create trigger after_profile_create_passport
after insert on public.profiles
for each row
execute function public.handle_profile_passport_insert();

create or replace function public.sync_passport_experience_from_pirep(
  p_pirep_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pirep public.pireps%rowtype;
  v_ledger_id uuid;
begin
  select *
  into v_pirep
  from public.pireps
  where id = p_pirep_id;

  if not found then
    return null;
  end if;

  perform public.ensure_pilot_passport(v_pirep.pilot_id);

  insert into public.pilot_experience_ledger (
    pilot_id,
    organization_id,
    source_pirep_id,
    booking_id,
    flight_number,
    aircraft_id,
    departure_airport_id,
    arrival_airport_id,
    block_minutes,
    pirep_status,
    flown_at,
    updated_at
  )
  values (
    v_pirep.pilot_id,
    'kalabsha-airlines',
    v_pirep.id,
    v_pirep.booking_id,
    v_pirep.flight_number,
    v_pirep.aircraft_id,
    v_pirep.departure_airport_id,
    v_pirep.arrival_airport_id,
    v_pirep.block_minutes,
    v_pirep.status,
    v_pirep.created_at,
    now()
  )
  on conflict (source_pirep_id)
  do update set
    block_minutes = excluded.block_minutes,
    pirep_status = excluded.pirep_status,
    aircraft_id = excluded.aircraft_id,
    updated_at = now()
  returning id into v_ledger_id;

  return v_ledger_id;
end;
$$;

revoke all on function public.sync_passport_experience_from_pirep(uuid)
from public, anon, authenticated;
grant execute on function public.sync_passport_experience_from_pirep(uuid)
to service_role;

create or replace function public.handle_pirep_passport_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_passport_experience_from_pirep(new.id);
  return new;
end;
$$;

drop trigger if exists after_pirep_passport_sync
on public.pireps;

create trigger after_pirep_passport_sync
after insert or update of status, block_minutes, aircraft_id
on public.pireps
for each row
execute function public.handle_pirep_passport_sync();

create or replace function public.get_public_pilot_passport(
  p_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'passportNumber', passport.passport_number,
    'publicSlug', passport.public_slug,
    'issuedAt', passport.issued_at,
    'fullName', profile.full_name,
    'callsign', profile.callsign,
    'totalHours', coalesce(profile.total_hours, 0),
    'totalFlights', coalesce(profile.total_flights, 0),
    'currentRank', coalesce((
      select jsonb_build_object(
        'code', rank_row.code,
        'name', rank_row.name
      )
      from public.ranks rank_row
      where rank_row.minimum_hours <= coalesce(profile.total_hours, 0)
        and rank_row.minimum_flights <= coalesce(profile.total_flights, 0)
      order by rank_row.priority desc
      limit 1
    ), jsonb_build_object('code', 'CADET', 'name', 'Cadet')),
    'memberships', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'organizationId', membership.organization_id,
          'organizationCode', organization.code,
          'organizationName', organization.name,
          'role', membership.role,
          'status', membership.status,
          'joinedAt', membership.joined_at,
          'isPrimary', membership.is_primary
        )
        order by membership.is_primary desc, membership.joined_at
      )
      from public.pilot_airline_memberships membership
      join public.platform_organizations organization
        on organization.id = membership.organization_id
      where membership.pilot_id = profile.id
        and membership.status = 'active'
    ), '[]'::jsonb),
    'qualifications', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'code', qualification.qualification_code,
          'name', qualification.qualification_name,
          'status', qualification.status,
          'issuedAt', qualification.issued_at,
          'expiresAt', qualification.expires_at,
          'aircraftType', fleet.icao_code
        )
        order by qualification.issued_at desc
      )
      from public.pilot_qualifications qualification
      left join public.fleet_types fleet
        on fleet.id = qualification.fleet_type_id
      where qualification.pilot_id = profile.id
        and qualification.status = 'active'
    ), '[]'::jsonb),
    'experience', jsonb_build_object(
      'flights', (
        select count(*)
        from public.pilot_experience_ledger ledger
        where ledger.pilot_id = profile.id
      ),
      'hours', (
        select round(coalesce(sum(ledger.block_minutes), 0) / 60.0, 1)
        from public.pilot_experience_ledger ledger
        where ledger.pilot_id = profile.id
      ),
      'verifiedFlights', (
        select count(*)
        from public.pilot_experience_ledger ledger
        where ledger.pilot_id = profile.id
          and ledger.pirep_status = 'approved'
      ),
      'verifiedHours', (
        select round(coalesce(sum(ledger.block_minutes), 0) / 60.0, 1)
        from public.pilot_experience_ledger ledger
        where ledger.pilot_id = profile.id
          and ledger.pirep_status = 'approved'
      )
    )
  )
  into v_result
  from public.pilot_passports passport
  join public.profiles profile
    on profile.id = passport.pilot_id
  where passport.public_slug = p_slug
    and passport.visibility = 'public'
    and passport.status = 'active';

  return v_result;
end;
$$;

revoke all on function public.get_public_pilot_passport(text)
from public;
grant execute on function public.get_public_pilot_passport(text)
to anon, authenticated;

-- Backfill passports and memberships.
do $$
declare
  v_profile record;
  v_pirep record;
begin
  for v_profile in
    select id from public.profiles
  loop
    perform public.ensure_pilot_passport(v_profile.id);
  end loop;

  for v_pirep in
    select id from public.pireps
    order by created_at, id
  loop
    perform public.sync_passport_experience_from_pirep(v_pirep.id);
  end loop;
end
$$;
