-- Safe follow-up hardening: no existing rows are rewritten.
-- Apply only through an authorized database connection after staging verification.
begin;

create or replace function public.enforce_active_pilot_operations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    -- PostgREST sets the request role even inside SECURITY DEFINER routines.
    -- Preserve trusted service/background/SQL-editor operations without a user JWT.
    if current_setting('role', true) in ('anon', 'authenticated') then
      raise exception 'Authentication required' using errcode = '42501';
    end if;
    return new;
  end if;
  if not exists (
    select 1 from public.profiles where id = actor and status = 'active'
  ) then
    raise exception 'Active pilot account required' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_active_pilot_operations() from public, anon, authenticated;
revoke truncate, trigger on public.flight_bookings, public.flights, public.pireps from public, anon, authenticated;

drop trigger if exists require_active_pilot_on_booking on public.flight_bookings;
create trigger require_active_pilot_on_booking before insert or update on public.flight_bookings
for each row execute function public.enforce_active_pilot_operations();

drop trigger if exists require_active_pilot_on_flight on public.flights;
create trigger require_active_pilot_on_flight before insert or update on public.flights
for each row execute function public.enforce_active_pilot_operations();

drop trigger if exists require_active_pilot_on_pirep on public.pireps;
create trigger require_active_pilot_on_pirep before insert or update on public.pireps
for each row execute function public.enforce_active_pilot_operations();

commit;
