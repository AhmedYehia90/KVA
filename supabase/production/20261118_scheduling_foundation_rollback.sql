-- Foundation-only rollback. Refuses to discard any new scheduling data.
-- Does NOT restore old booking data over newer real bookings.
begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
do $$ begin
 if not pg_try_advisory_xact_lock(hashtextextended('kva.scheduling.foundation.v1',0)) then raise exception 'Another foundation change is running'; end if;
 if not exists(select 1 from kva_scheduling_private.foundation_manifest where version=1 and phase='foundation' and not scheduling_enabled) then
   raise exception 'Not an inactive phase-one foundation'; end if;
end $$;
lock table public.flight_bookings,public.scheduled_flights,public.aircraft_allocations,public.fleet_scheduling_rules in access exclusive mode;
do $$ begin
 if exists(select 1 from public.scheduled_flights) or exists(select 1 from public.aircraft_allocations)
   or exists(select 1 from public.fleet_scheduling_rules) or exists(select 1 from public.flight_bookings where scheduled_flight_id is not null) then
   raise exception 'Scheduling data exists: refusing destructive rollback. Use a reviewed recovery plan'; end if;
end $$;
-- RESTRICT throughout: unknown dependent objects abort the entire transaction.
drop index public.one_active_pilot_per_schedule;
alter table public.flight_bookings drop column scheduled_flight_id restrict;
drop table public.aircraft_allocations restrict;
drop table public.scheduled_flights restrict;
drop table public.fleet_scheduling_rules restrict;
drop table kva_scheduling_private.foundation_manifest restrict;
drop schema kva_scheduling_private restrict;
-- btree_gist is intentionally retained: it may now be shared by other features.
select 'PASS: inactive foundation removed; all current legacy bookings preserved' as result;
notify pgrst,'reload schema';
commit;
