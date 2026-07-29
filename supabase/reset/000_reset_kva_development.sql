-- DANGER: Development only. Deletes all KVA public-schema objects.
drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.audit_logs cascade;
drop table if exists public.pilot_awards cascade;
drop table if exists public.awards cascade;
drop table if exists public.events cascade;
drop table if exists public.pireps cascade;
drop table if exists public.flights cascade;
drop table if exists public.routes cascade;
drop table if exists public.aircraft cascade;
drop table if exists public.fleet_types cascade;
drop table if exists public.airports cascade;
drop table if exists public.profiles cascade;
drop table if exists public.ranks cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.assign_profile_identity() cascade;
drop function if exists public.assign_pirep_code() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.is_staff() cascade;

drop sequence if exists public.pilot_number_seq cascade;
drop sequence if exists public.pirep_number_seq cascade;

drop type if exists public.pirep_status cascade;
drop type if exists public.flight_status cascade;
drop type if exists public.aircraft_status cascade;
drop type if exists public.pilot_status cascade;
drop type if exists public.user_role cascade;
