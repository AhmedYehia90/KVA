-- READ ONLY: after a successful foundation application. No personal rows exported.
begin read only;
select
 m.version,
 m.phase,
 m.scheduling_enabled,
 m.backup_checksum,
 (select count(*) from public.scheduled_flights) as scheduled_flights,
 (select count(*) from public.aircraft_allocations) as allocations,
 (select count(*) from public.fleet_scheduling_rules) as fleet_rules,
 (select count(*) from public.flight_bookings where scheduled_flight_id is not null) as assigned_scheduled_bookings,
 not exists(
   select 1 from jsonb_array_elements(m.baseline->'legacy_functions') f
   where pg_get_functiondef(to_regprocedure(f->>'signature')) is distinct from f->>'definition'
      or (select proacl::text from pg_proc where oid=to_regprocedure(f->>'signature')) is distinct from f->>'acl'
 ) as legacy_functions_and_permissions_unchanged
from kva_scheduling_private.foundation_manifest m;
commit;
