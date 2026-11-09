-- REVIEW REQUIRED: run against a staging database first. Not applied during implementation.
-- No pilot records or visibility settings are rewritten by this migration.
begin;

alter table public.profiles enable row level security;

-- Remove both table-level and any legacy column-level grants, then allow only
-- authenticated reads and harmless profile edits. SECURITY DEFINER operational
-- routines and the service role retain their existing execution model.
revoke all privileges on table public.profiles from public, anon, authenticated;
do $$
declare columns_sql text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum)
    into columns_sql
  from pg_attribute
  where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped;
  execute format('revoke all privileges (%s) on table public.profiles from public, anon, authenticated', columns_sql);
end;
$$;
grant select on table public.profiles to authenticated;
grant update (full_name, country_code, avatar_url) on public.profiles to authenticated;

-- Restrictive policies also constrain unknown legacy permissive policies.
-- Keep the existing permissive owner/staff policies as the positive allow rule.
drop policy if exists profiles_privacy_select_guard on public.profiles;
create policy profiles_privacy_select_guard on public.profiles
as restrictive for select to authenticated
using (auth.uid() = id or public.is_staff());
drop policy if exists profiles_privacy_update_guard on public.profiles;
create policy profiles_privacy_update_guard on public.profiles
as restrictive for update to authenticated
using (auth.uid() = id or public.is_staff())
with check (auth.uid() = id or public.is_staff());

-- Public passport API: preserve the explicit opt-in and active-passport filter,
-- but remove the full name at the database/API boundary, not just in the UI.
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
from public, anon, authenticated;
grant execute on function public.get_public_pilot_passport(text)
to anon, authenticated;


commit;
