"""Real PostgreSQL, independent-session tests. No Supabase/network credentials used.
Requires a disposable docker container labelled kva.scope=isolated-scheduling-test,
with --network none, no published ports, and PostgreSQL 17 + btree_gist.
"""
import concurrent.futures
import json
import pathlib
import subprocess
import threading
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
CONTAINER = 'kva-scheduling-phase1'
DATABASE = 'kva_phase1_test'
info = json.loads(subprocess.check_output(['docker', 'inspect', CONTAINER]))[0]
assert info['Config']['Labels'].get('kva.scope') == 'isolated-scheduling-test'
assert info['HostConfig']['NetworkMode'] == 'none'
assert not info['HostConfig'].get('PortBindings')

def sql(source, role=None, actor=None, okay=True, database=DATABASE):
    prefix = ''
    if actor:
        prefix += f"set request.jwt.claim.sub='{actor}';"
    if role:
        prefix += f'set role {role};'
    result = subprocess.run(['docker','exec','-i',CONTAINER,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-U','postgres','-d',database],
                            input=prefix+source,text=True,capture_output=True,timeout=30)
    if okay:
        assert result.returncode == 0, result.stderr
        return result.stdout.strip()
    assert result.returncode != 0, 'Expected rejection, got: '+result.stdout
    return result.stderr

def uid(number): return str(uuid.UUID(int=number))
ADMIN,P1,P2,PENDING=[uid(n) for n in range(1,5)]
A,B,C=[uid(n) for n in range(10,13)]
FLEET,OTHER=uid(20),uid(21)
TAIL,TAIL2,UNKNOWN,MAINT,LEGACY,WRONG=[uid(n) for n in range(30,36)]
AB,BA,AC=[uid(n) for n in range(40,43)]
LEGACY_BOOKING=uid(50)
sql(f'drop database if exists {DATABASE};',database='postgres')
sql(f'create database {DATABASE};',database='postgres')
roles=sql("select rolname from pg_roles where rolname in ('anon','authenticated','service_role');",database='postgres')
for role in ['anon','authenticated','service_role']:
    if role not in roles.splitlines(): sql('create role '+role+';',database='postgres')
sql(f"""
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to anon,authenticated,service_role;
create table profiles(id uuid primary key,status text,role text,total_hours numeric default 0,total_flights integer default 0);
insert into profiles(id,status,role) values('{ADMIN}','active','admin'),('{P1}','active','pilot'),('{P2}','active','pilot'),('{PENDING}','pending','pilot');
create function is_staff() returns boolean language sql security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and status='active' and role in ('admin','staff','dispatcher'))$$;
create table airports(id uuid primary key,icao_code text);
insert into airports values('{A}','HECA'),('{B}','HESN'),('{C}','HELX');
create table fleet_types(id uuid primary key);
insert into fleet_types values('{FLEET}'),('{OTHER}');
create table aircraft(id uuid primary key,registration text,fleet_type_id uuid,status text,current_airport_id uuid);
insert into aircraft values('{TAIL}','SU-TEST1','{FLEET}','active','{A}'),('{TAIL2}','SU-TEST2','{FLEET}','active','{A}'),('{UNKNOWN}','SU-UNKNOWN','{FLEET}','active',null),('{MAINT}','SU-MAINT','{FLEET}','maintenance','{A}'),('{LEGACY}','SU-LEGACY','{FLEET}','active','{A}'),('{WRONG}','SU-WRONG','{OTHER}','active','{A}');
create table routes(id uuid primary key,flight_number text,fleet_type_id uuid,departure_airport_id uuid,arrival_airport_id uuid,active boolean);
insert into routes values('{AB}','KVA100','{FLEET}','{A}','{B}',true),('{BA}','KVA101','{FLEET}','{B}','{A}',true),('{AC}','KVA102','{FLEET}','{A}','{C}',true);
create table flight_bookings(id uuid primary key default gen_random_uuid(),route_id uuid,pilot_id uuid,aircraft_id uuid,status text,booked_at timestamptz default now(),cancelled_at timestamptz);
create unique index uq_flight_bookings_active_pilot on flight_bookings(pilot_id) where status in ('booked','boarding','departed','enroute','landed');
insert into flight_bookings(id,route_id,pilot_id,aircraft_id,status) values('{LEGACY_BOOKING}','{AB}','{ADMIN}','{LEGACY}','booked');
alter table flight_bookings enable row level security;
create policy owner_read on flight_bookings for select to authenticated using(pilot_id=auth.uid());
create policy owner_write on flight_bookings for all to authenticated using(pilot_id=auth.uid()) with check(pilot_id=auth.uid());
grant select,insert,update,delete on flight_bookings to authenticated;
create table dispatches(id uuid default gen_random_uuid(),booking_id uuid,dispatch_number text,route text,remarks text);
create table aircraft_operational_state(aircraft_id uuid primary key,operational_status text);
insert into aircraft_operational_state values('{TAIL}','available');
""")
# Compile the actual repository legacy RPCs before the staging wrappers replace them.
legacy=(ROOT/'supabase/migrations/20260805123000_flight_events_integration.sql').read_text()
sql(legacy[:legacy.index('-- Booking and dispatch')])
foundation=(ROOT/'supabase/migrations/20260729132500_flight_operations_foundation_fixed.sql').read_text()
sql(foundation[foundation.index('create sequence if not exists public.dispatch_number_seq'):foundation.index('drop trigger if exists flight_bookings_updated_at')])
for name,next_name in [('book_route','advance_flight_booking'),('advance_flight_booking','submit_booking_pirep')]:
    start=legacy.index('create or replace function public.'+name+'(')
    end=legacy.index('create or replace function public.'+next_name+'(',start)
    sql(legacy[start:end])
operation=(ROOT/'supabase/migrations/20260803130500_flight_operations_engine.sql').read_text()
start=operation.index('create or replace function public.advance_flight_operation(')
end=operation.index('$$;',start)+3
sql(operation[start:end])
baseline=sql(f"select row_to_json(b) from flight_bookings b where id='{LEGACY_BOOKING}';")
profile_before=sql('select json_agg(p order by id) from profiles p;')
aircraft_before=sql('select json_agg(a order by id) from aircraft a;')
stage=(ROOT/'supabase/staging/scheduling_phase1.sql').read_text()
assert 'Isolated scheduling test environment required' in sql(stage,okay=False)
sql("set kva.scheduling_test_environment='isolated';"+stage)
print('PASS staging guard rejects unmarked DB; actual SQL installs on PostgreSQL 17')
assert sql(f"select to_jsonb(b)-'scheduled_flight_id' from flight_bookings b where id='{LEGACY_BOOKING}';") == sql(f"select ('{baseline}'::jsonb)::text;")
assert sql(f"select scheduled_flight_id is null from flight_bookings where id='{LEGACY_BOOKING}';")=='t'
print('PASS legacy booking fields preserved and no occurrence/date fabricated')

def staff(source,okay=True): return sql(source,'authenticated',ADMIN,okay)
def pilot(source,actor=P1,okay=True): return sql(source,'authenticated',actor,okay)
def create(route=AB,tail=TAIL,departure='2099-01-01 20:00+00',arrival='2099-01-01 21:00+00',okay=True):
    return staff(f"select create_scheduled_flight('{route}','{tail}','{departure}','{arrival}','Africa/Cairo');",okay)

staff(f"select set_fleet_scheduling_rule('{FLEET}',30,45);")
for role,actor in [('anon',None),('authenticated',P1),('authenticated',PENDING)]:
    sql(f"select set_fleet_scheduling_rule('{FLEET}',0,0);",role,actor,False)
    sql("insert into scheduled_flights default values;",role,actor,False)
    sql("update aircraft_allocations set released_at=now();",role,actor,False)
print('PASS staff-only administration; direct pilot/anonymous schedule writes denied')
for tail in [UNKNOWN,MAINT,LEGACY,WRONG]: create(tail=tail,okay=False)
create(route=BA,okay=False)
create(arrival='2099-01-01 19:00+00',okay=False)
create(departure='2000-01-01 20:00+00',arrival='2000-01-01 21:00+00',okay=False)
staff(f"select create_scheduled_flight('{AB}','{TAIL}','2099-01-01 20:00+00','2099-01-01 21:00+00','Fake/Zone');",False)
print('PASS unknown location, maintenance, unresolved legacy, wrong type/origin, bad times and timezone rejected')
s1=create()
assert '23P01' in create(route=AC,departure='2099-01-01 20:15+00',arrival='2099-01-01 21:15+00',okay=False)
# First flight ready 21:45; next preflight starts 21:45, so departure may be 22:15.
assert '23P01' in create(route=BA,departure='2099-01-01 22:14+00',arrival='2099-01-01 23:14+00',okay=False)
s2=create(route=BA,departure='2099-01-01 22:15+00',arrival='2099-01-01 23:15+00')
assert sql(f"select lower(occupied_during)::text||'/'||upper(occupied_during)::text from aircraft_allocations where scheduled_flight_id='{s1}';").startswith('2099-01-01 19:30:00+00/2099-01-01 21:45:00+00')
staff(f"select cancel_scheduled_flight('{s1}');",False)
staff(f"select reschedule_flight('{s1}','{TAIL}','2099-01-01 21:30+00','2099-01-01 22:30+00');",False)
print('PASS preparation/turnaround boundaries, overlap exclusion, predecessor/successor chain and cancellation rollback')
block=staff(f"select block_aircraft('{TAIL2}','2099-03-01 18:00+00','2099-03-01 23:00+00','Synthetic maintenance');")
assert '23P01' in create(tail=TAIL2,departure='2099-03-01 20:00+00',arrival='2099-03-01 21:00+00',okay=False)
pilot(f"select release_aircraft_block('{block}');",P1,False)
staff(f"select release_aircraft_block('{block}');")
print('PASS future maintenance shares the aircraft overlap constraint; pilots cannot release it')
# Booking race uses separate psql connections, not a single-session emulator.
barrier=threading.Barrier(2)
def race_book(actor):
    barrier.wait()
    return subprocess.run(['docker','exec','-i',CONTAINER,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',DATABASE],input=f"set role authenticated;set request.jwt.claim.sub='{actor}';begin;select book_scheduled_flight('{s1}');select pg_sleep(0.3);commit;",text=True,capture_output=True,timeout=30)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(race_book,[P1,P2]))
assert sum(r.returncode==0 for r in results)==1,[r.stderr for r in results]
winner=sql(f"select pilot_id from flight_bookings where scheduled_flight_id='{s1}' and status='booked';")
booking=sql(f"select id from flight_bookings where scheduled_flight_id='{s1}' and status='booked';")
assert sql(f"select count(*) from flight_bookings where scheduled_flight_id='{s1}';")=='1'
assert sql('select count(*) from dispatches;')=='1'
assert sql("select count(*) from platform_events where event_type='schedule.booking_created';")=='1'
print('PASS real concurrent booking race: exactly one booking, dispatch and scheduling event')
for actor in [P1,P2]: pilot(f"select book_route('{AB}');",actor,False)
pilot(f"select book_scheduled_flight('{s2}');",PENDING,False)
pilot(f"update flight_bookings set status='cancelled' where id='{booking}';",winner,False)
pilot(f"delete from flight_bookings where id='{booking}';",winner,False)
pilot(f"insert into flight_bookings(route_id,pilot_id,aircraft_id,status) values('{AB}','{winner}','{TAIL}','booked');",winner,False)
for name in ['advance_flight_booking','advance_flight_operation','phase1_legacy_advance_booking','phase1_legacy_advance_operation']:
    pilot(f"select {name}('{booking}');",winner,False)
staff(f"select reschedule_flight('{s1}','{TAIL}','2099-01-01 20:01+00','2099-01-01 21:01+00');",False)
print('PASS legacy RPC/direct writes/execution bypass denied; inactive pilot and booked reschedule rejected')
other=P2 if winner==P1 else P1
pilot(f"select cancel_scheduled_booking('{booking}');",other,False)
pilot(f"select cancel_scheduled_booking('{booking}');",winner)
pilot(f"select book_scheduled_flight('{s1}');",other)
print('PASS own preflight cancellation and subsequent real rebooking without deleting history')
# Concurrent different occurrences competing for the same tail and time.
barrier=threading.Barrier(2)
def race_allocate(route):
    barrier.wait()
    return subprocess.run(['docker','exec','-i',CONTAINER,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',DATABASE],input=f"set role authenticated;set request.jwt.claim.sub='{ADMIN}';begin;select create_scheduled_flight('{route}','{TAIL2}','2099-02-01 20:00+00','2099-02-01 21:00+00','Africa/Cairo');select pg_sleep(0.3);commit;",text=True,capture_output=True,timeout=30)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(race_allocate,[AB,AC]))
assert sum(r.returncode==0 for r in results)==1,[r.stderr for r in results]
print('PASS real concurrent allocation race: same tail cannot serve overlapping occurrences')
race_schedule=sql(f"select scheduled_flight_id from aircraft_allocations where aircraft_id='{TAIL2}' and released_at is null;")
barrier=threading.Barrier(2)
def race_same_pilot(schedule):
    barrier.wait()
    return subprocess.run(['docker','exec','-i',CONTAINER,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',DATABASE],input=f"set role authenticated;set request.jwt.claim.sub='{winner}';begin;select book_scheduled_flight('{schedule}');select pg_sleep(0.3);commit;",text=True,capture_output=True,timeout=30)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(race_same_pilot,[s2,race_schedule]))
assert sum(r.returncode==0 for r in results)==1,[r.stderr for r in results]
print('PASS same pilot concurrently booking different occurrences gets only one active booking')
sql(f"""begin;
insert into aircraft values('{uid(90)}','SU-EDIT1','{FLEET}','active','{A}'),('{uid(91)}','SU-EDIT2','{FLEET}','active','{A}');
set request.jwt.claim.sub='{ADMIN}';set role authenticated;
do $$declare s uuid;begin
 s:=public.create_scheduled_flight('{AC}','{uid(90)}','2099-04-01 23:40+00','2099-04-02 01:00+00','Africa/Cairo');
 perform public.reschedule_flight(s,'{uid(91)}','2099-04-02 23:40+00','2099-04-03 01:00+00');
 if not exists(select 1 from public.aircraft_allocations where scheduled_flight_id=s and aircraft_id='{uid(91)}'
   and lower(occupied_during)='2099-04-02 23:10+00'::timestamptz and upper(occupied_during)='2099-04-03 01:45+00'::timestamptz) then
   raise exception 'Reschedule did not refresh allocation'; end if;
 perform public.cancel_scheduled_flight(s);
 if not exists(select 1 from public.scheduled_flights where id=s and status='cancelled') then raise exception 'Cancellation failed';end if;
end$$;
rollback;""")
print('PASS successful reassignment/reschedule/cancellation and UTC midnight occupancy; history changes stay transactional')
sql(f"""begin;update routes set departure_airport_id='{C}',flight_number='CHANGED' where id='{AB}';
do $$begin if not exists(select 1 from scheduled_flights where id='{s1}' and departure_airport_id='{A}' and flight_number='KVA100') then raise exception 'Route edit changed occurrence'; end if;end$$;rollback;""")
print('PASS route-template edits do not change published occurrence airport/flight-number snapshots')
assert sql("select count(*) from aircraft_allocations a join aircraft_allocations b on a.id<b.id and a.aircraft_id=b.aircraft_id and a.occupied_during&&b.occupied_during where a.released_at is null and b.released_at is null;")=='0'
assert sql('select json_agg(p order by id) from profiles p;')==profile_before
assert sql('select json_agg(a order by id) from aircraft a;')==aircraft_before
assert sql(f"select to_jsonb(b)-'scheduled_flight_id' from flight_bookings b where id='{LEGACY_BOOKING}';")==sql(f"select ('{baseline}'::jsonb)::text;")
assert sql('select count(*) from list_scheduled_flights();','anon',okay=False)
projection=json.loads(pilot('select json_agg(s) from list_scheduled_flights() s;'))
assert projection and all('pilot_id' not in r and 'email' not in r for r in projection)
print('PASS legacy records, all pilot statistics and actual aircraft positions unchanged; schedule DTO excludes pilot PII')
print('ALL PHASE 1 POSTGRESQL TESTS PASSED')
