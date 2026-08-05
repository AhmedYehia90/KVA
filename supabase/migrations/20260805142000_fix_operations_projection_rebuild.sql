-- Fix Operations Projector rebuild for environments requiring a DELETE WHERE clause.

create or replace function public.rebuild_operations_projection()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record record;
  v_count integer := 0;
begin
  delete from public.event_processing_log
  where consumer_name = 'operations.projector';

  delete from public.operations_flight_projection
  where booking_id is not null;

  for v_record in
    select id
    from public.platform_events
    where event_type in (
      'flight.booked',
      'aircraft.assigned',
      'dispatch.created',
      'flight.boarding_started',
      'flight.pushback_started',
      'flight.takeoff_recorded',
      'flight.landing_recorded',
      'flight.completed',
      'pirep.created'
    )
    order by occurred_at, created_at, id
  loop
    if public.project_operations_event(v_record.id) then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.rebuild_operations_projection()
from public, anon, authenticated;

grant execute on function public.rebuild_operations_projection()
to service_role;