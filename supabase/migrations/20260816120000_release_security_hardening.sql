-- KVA OS v1.0 - Release Security Hardening 1
-- Narrow scope only. No business-logic replacement.

-- Pin search_path on functions flagged by Supabase Security Advisor.
alter function public.assign_pirep_code() set search_path = '';
alter function public.set_updated_at() set search_path = '';
alter function public.assign_profile_identity() set search_path = '';
alter function public.assign_dispatch_number() set search_path = '';
alter function public.museum_safe_annual_date(date, integer) set search_path = '';
alter function public.living_airport_pulse_score(
  integer, integer, integer, integer, integer, integer, integer
) set search_path = '';
alter function public.museum_next_anniversary_date(date, date) set search_path = '';
alter function public.living_airport_pulse_label(integer) set search_path = '';

-- Authenticated-only pilot mutation RPCs:
-- preserve authenticated/service_role; remove anonymous execution.
revoke execute on function public.advance_flight_booking(uuid) from anon, public;
grant execute on function public.advance_flight_booking(uuid) to authenticated, service_role;

revoke execute on function public.advance_flight_operation(uuid) from anon, public;
grant execute on function public.advance_flight_operation(uuid) to authenticated, service_role;

revoke execute on function public.book_route(uuid) from anon, public;
grant execute on function public.book_route(uuid) to authenticated, service_role;

revoke execute on function public.submit_booking_pirep(
  uuid, integer, integer, numeric, text
) from anon, public;
grant execute on function public.submit_booking_pirep(
  uuid, integer, integer, numeric, text
) to authenticated, service_role;

-- Intentional exceptions:
-- get_public_pilot_passport(text) remains public.
-- is_staff() remains unchanged because current RLS policies depend on it.
-- SECURITY DEFINER trigger helpers are deferred to a structural/private-schema review.
