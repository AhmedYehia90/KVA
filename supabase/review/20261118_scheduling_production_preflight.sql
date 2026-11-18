-- READ ONLY: collect the current hosted baseline before proposing a production
-- scheduling migration. Does not grant privileges, execute booking functions,
-- create tables, modify records, or expose pilot names/emails.
begin read only;
select jsonb_build_object(
  'checked_at', now(),
  'server_version', current_setting('server_version'),
  'scheduling_tables', jsonb_build_object(
    'scheduled_flights', to_regclass('public.scheduled_flights'),
    'aircraft_allocations', to_regclass('public.aircraft_allocations'),
    'fleet_scheduling_rules', to_regclass('public.fleet_scheduling_rules')
  ),
  'booking_columns', (
    select jsonb_agg(jsonb_build_object('name',column_name,'type',data_type,'nullable',is_nullable) order by ordinal_position)
    from information_schema.columns where table_schema='public' and table_name='flight_bookings'
  ),
  'booking_policies', (
    select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname='public' and tablename='flight_bookings'
  ),
  'booking_indexes', (
    select jsonb_agg(jsonb_build_object('name',indexname,'definition',indexdef))
    from pg_indexes where schemaname='public' and tablename='flight_bookings'
  ),
  'booking_triggers', (
    select jsonb_agg(jsonb_build_object('name',tgname,'enabled',tgenabled,'definition',pg_get_triggerdef(oid)))
    from pg_trigger where tgrelid='public.flight_bookings'::regclass and not tgisinternal
  ),
  'book_route_definition', pg_get_functiondef(to_regprocedure('public.book_route(uuid)')),
  'advance_booking_definition', pg_get_functiondef(to_regprocedure('public.advance_flight_booking(uuid)')),
  'advance_operation_definition', pg_get_functiondef(to_regprocedure('public.advance_flight_operation(uuid)')),
  'booking_status_counts', (
    select jsonb_agg(to_jsonb(s)) from (
      select status,count(*) as records from public.flight_bookings group by status order by status
    ) s
  ),
  'active_booking_readiness', (
    select jsonb_build_object('count',count(*),'without_aircraft',count(*) filter(where aircraft_id is null))
    from public.flight_bookings where status in ('booked','boarding','departed','enroute','landed')
  ),
  'aircraft_status_counts', (
    select jsonb_agg(to_jsonb(s)) from (
      select status,count(*) as records,count(*) filter(where current_airport_id is null) as unknown_location
      from public.aircraft group by status order by status
    ) s
  ),
  'btree_gist_available', exists(select 1 from pg_available_extensions where name='btree_gist')
) as production_scheduling_preflight;
commit;
