-- OWNER ONLY. Do not run until the prepared cutover, aircraft plan and gated
-- application release are reviewed. Scheduled flight execution remains disabled.
begin;
set local lock_timeout='10s';set local statement_timeout='120s';
select kva_scheduling_private.activate_scheduled_booking();
select phase,scheduling_enabled from kva_scheduling_private.foundation_manifest;
notify pgrst,'reload schema';
commit;
