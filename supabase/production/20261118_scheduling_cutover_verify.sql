-- READ ONLY: use after preparation/activation, not the foundation-only verifier.
begin read only;
select
 m.phase,
 m.scheduling_enabled,
 public.scheduling_mode_enabled() as api_mode,
 b.backup_checksum,
 (select count(*) from public.scheduled_flights) as scheduled_flights,
 (select count(*) from public.aircraft_allocations where released_at is null) as active_allocations,
 (select count(*) from public.fleet_scheduling_rules) as fleet_rules,
 (select count(*) from public.flight_bookings where scheduled_flight_id is null and status in ('booked','boarding','departed','enroute','landed')) as active_legacy_bookings,
 not exists(
   select 1 from jsonb_array_elements(b.legacy_proc) f
   left join pg_proc p on p.oid=(f->>'oid')::oid
   where p.prosrc is distinct from f->>'source'
      or coalesce(to_jsonb(p.proconfig),'null'::jsonb) is distinct from f->'config'
 ) as archived_legacy_sources_unchanged,
 not exists(
   select 1 from jsonb_array_elements(b.legacy_proc) f
   left join pg_proc p on p.oid=to_regprocedure(format('public.%I(uuid)',f->>'name'))
   where p.proacl::text is distinct from f->>'acl'
 ) as legacy_public_execute_grants_preserved,
 not exists(
   select 1 from jsonb_array_elements(b.legacy_proc) f
   cross join (values('anon'),('authenticated'),('service_role')) r(role_name)
   where has_function_privilege(r.role_name,(f->>'oid')::oid,'EXECUTE')
 ) as private_archives_blocked_to_clients,
 exists(select 1 from pg_trigger where tgrelid='public.flight_bookings'::regclass and tgname='guard_scheduled_booking' and tgenabled='O') as booking_guard_enabled
from kva_scheduling_private.foundation_manifest m
cross join kva_scheduling_private.cutover_backup b;
commit;
