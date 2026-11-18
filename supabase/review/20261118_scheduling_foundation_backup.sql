-- READ ONLY. Export the complete result as CSV and keep it privately off-server.
-- Contains booking pilot UUIDs; send only backup_checksum, not the data file.
-- Scoped backup for this additive migration, NOT a full PostgreSQL/Auth backup.
begin read only;
set local time zone 'UTC';
set local search_path=pg_catalog,public,extensions;
with baseline as (
select jsonb_build_object(
 'format_version',1,
 'database',current_database(),
 'server_version',current_setting('server_version'),
 'bookings',coalesce((select jsonb_agg(to_jsonb(b) order by b.id) from public.flight_bookings b),'[]'::jsonb),
 'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
   from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
   where a.attrelid='public.flight_bookings'::regclass and a.attnum>0 and not a.attisdropped),
 'rls',(select jsonb_build_object('enabled',relrowsecurity,'forced',relforcerowsecurity,'acl',relacl::text) from pg_class where oid='public.flight_bookings'::regclass),
 'policies',coalesce((select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where schemaname='public' and tablename='flight_bookings'),'[]'::jsonb),
 'indexes',coalesce((select jsonb_agg(jsonb_build_object('name',indexname,'definition',indexdef) order by indexname) from pg_indexes where schemaname='public' and tablename='flight_bookings'),'[]'::jsonb),
 'constraints',coalesce((select jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid)) order by conname) from pg_constraint where conrelid='public.flight_bookings'::regclass),'[]'::jsonb),
 'triggers',coalesce((select jsonb_agg(jsonb_build_object('name',tgname,'enabled',tgenabled,'definition',pg_get_triggerdef(oid)) order by tgname) from pg_trigger where tgrelid='public.flight_bookings'::regclass and not tgisinternal),'[]'::jsonb),
 'column_grants',coalesce((select jsonb_agg(to_jsonb(g) order by grantor,grantee,column_name,privilege_type,is_grantable) from information_schema.column_privileges g where table_schema='public' and table_name='flight_bookings'),'[]'::jsonb),
 'legacy_functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text) order by p.proname)
   from pg_proc p where p.oid in (to_regprocedure('public.book_route(uuid)'),to_regprocedure('public.advance_flight_booking(uuid)'),to_regprocedure('public.advance_flight_operation(uuid)')))
) as payload
)
select payload as backup_payload,md5(payload::text) as backup_checksum
from baseline;
commit;
