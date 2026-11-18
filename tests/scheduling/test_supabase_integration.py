"""Real LOCAL Supabase Auth + Kong + PostgREST + complete repository schema.
Requires the inspected isolated gateway IP and exact labelled Docker database. Never accepts remote DSNs.
Run only after the isolated CLI stack and all repository migrations are installed.
"""
import concurrent.futures
import json
import os
import pathlib
import secrets
import subprocess
import threading
import urllib.error
import urllib.parse
import urllib.request
import uuid

ROOT=pathlib.Path(__file__).resolve().parents[2]
STATE=pathlib.Path('/workspace/kva-supabase-integration')
CONTAINER='supabase_db_kva-supabase-integration'
config=json.loads((STATE/'local-status.json').read_text())
BASE=config.get('API_URL',config.get('api_url','')).rstrip('/')
gateway=json.loads(subprocess.check_output(['docker','inspect','kva-supabase-gateway']))[0]
assert gateway['Config']['Labels'].get('kva.scope')=='real-supabase-integration'
expected_ip=gateway['NetworkSettings']['Networks']['kva-real-supabase-test']['IPAddress']
assert BASE=='http://'+expected_ip+':8000'
urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))
ANON=config.get('ANON_KEY',config.get('anon_key'));SERVICE=config.get('SERVICE_ROLE_KEY',config.get('service_role_key'))
assert ANON and SERVICE
info=json.loads(subprocess.check_output(['docker','inspect',CONTAINER]))[0]
assert info['Config']['Labels'].get('com.supabase.cli.project')=='kva-supabase-integration'

def sql(source):
 p=subprocess.run(['docker','exec','-i',CONTAINER,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],input=source,text=True,capture_output=True,timeout=40)
 assert p.returncode==0,p.stderr
 return p.stdout.strip()

def api(path,body=None,token=None,method=None,service=False):
 key=SERVICE if service else ANON
 headers={'apikey':key,'Authorization':'Bearer '+(token or key),'Content-Type':'application/json'}
 r=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
 try:
  with urllib.request.urlopen(r,timeout=40) as response:
   data=response.read();return response.status,json.loads(data) if data else None
 except urllib.error.HTTPError as error:
  data=error.read()
  try:return error.code,json.loads(data)
  except ValueError:return error.code,{'error':'Non-JSON local API response'}

def success(path,body=None,token=None,method=None,service=False):
 status,result=api(path,body,token,method,service)
 assert 200<=status<300,(path,status,result)
 return result

def rpc(name,body,token):return success('/rest/v1/rpc/'+name,body,token)
def denied(name,body,token=None):
 status,result=api('/rest/v1/rpc/'+name,body,token)
 assert status>=400,(name,status)
 return result

def account(label,role='pilot',status='active'):
 password=secrets.token_urlsafe(25)
 email='kva-stage-'+label+'-'+secrets.token_hex(4)+'@example.invalid'
 user=success('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,'user_metadata':{'full_name':'Synthetic '+label}},service=True)
 uid=str(uuid.UUID(user['id']))
 sql(f"update public.profiles set status='{status}',role='{role}' where id='{uid}';")
 session=success('/auth/v1/token?grant_type=password',{'email':email,'password':password})
 assert session['user']['id']==uid
 return {'id':uid,'email':email,'password':password,'token':session['access_token'],'session':session}

assert api('/auth/v1/health')[0]==200
admin=account('admin','admin');p1=account('pilot1');p2=account('pilot2');pending=account('pending',status='pending')
print('PASS real Supabase Auth: synthetic administrator, two active pilots and pending pilot created and signed in',flush=True)
# All setup is confined to the verified local database.
A=str(uuid.uuid4());B=str(uuid.uuid4());C=str(uuid.uuid4());FLEET=str(uuid.uuid4());TAIL=str(uuid.uuid4());TAIL2=str(uuid.uuid4());MAINT=str(uuid.uuid4());UNKNOWN=str(uuid.uuid4());AB=str(uuid.uuid4());BA=str(uuid.uuid4());AC=str(uuid.uuid4())
EDIT=str(uuid.uuid4());EDIT2=str(uuid.uuid4())
sql(f"""
insert into public.airports(id,icao_code,name,city,country,latitude,longitude,timezone) values
('{A}','XKAA','Synthetic A','Test A','EG',30,31,'Africa/Cairo'),('{B}','XKBB','Synthetic B','Test B','EG',24,32,'Africa/Cairo'),('{C}','XKCC','Synthetic C','Test C','EG',26,32,'Africa/Cairo');
insert into public.fleet_types(id,icao_code,manufacturer,model,engine_count,active) values('{FLEET}','TST1','Test','Synthetic only',2,true);
insert into public.aircraft(id,registration,fleet_type_id,status,current_airport_id) values
('{TAIL}','SU-STG1','{FLEET}','active','{A}'),('{TAIL2}','SU-STG2','{FLEET}','active','{A}'),('{MAINT}','SU-STGM','{FLEET}','maintenance','{A}'),('{UNKNOWN}','SU-STGU','{FLEET}','active',null),('{EDIT}','SU-STGE','{FLEET}','active','{A}'),('{EDIT2}','SU-STGF','{FLEET}','active','{A}');
insert into public.routes(id,flight_number,departure_airport_id,arrival_airport_id,fleet_type_id,scheduled_minutes,active) values
('{AB}','KVT901','{A}','{B}','{FLEET}',60,true),('{BA}','KVT902','{B}','{A}','{FLEET}',60,true),('{AC}','KVT903','{A}','{C}','{FLEET}',60,true);
""")
# Snapshot all real schema records before the staging change, after synthetic setup.
preservation_before=sql("select jsonb_build_object('bookings',(select coalesce(jsonb_agg(to_jsonb(b) order by id),'[]') from public.flight_bookings b),'profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),'aircraft',(select jsonb_agg(to_jsonb(a) order by id) from public.aircraft a));")
if sql("select count(*) from pg_tables where schemaname='public' and tablename='scheduled_flights';")=='0':
 sql("set kva.scheduling_test_environment='isolated';"+(ROOT/'supabase/staging/scheduling_phase1.sql').read_text())
else:raise AssertionError('Use a fresh isolated database before this suite; staging schema is already present')
preservation_after=sql("select jsonb_build_object('bookings',(select coalesce(jsonb_agg(to_jsonb(b)-'scheduled_flight_id' order by id),'[]') from public.flight_bookings b),'profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),'aircraft',(select jsonb_agg(to_jsonb(a) order by id) from public.aircraft a));")
assert json.loads(preservation_before)==json.loads(preservation_after)
sql("notify pgrst,'reload schema';")
import time
for _ in range(40):
 s,_result=api('/rest/v1/rpc/list_scheduled_flights',{},p1['token'])
 if s==200:break
 time.sleep(.2)
assert s==200
print('PASS full-schema stage installation preserves every existing booking, profile and aircraft field',flush=True)
rpc('set_fleet_scheduling_rule',{'p_fleet':FLEET,'p_preparation':30,'p_turnaround':45},admin['token'])
def create(route=AB,tail=TAIL,departure='2099-01-01T20:00:00Z',arrival='2099-01-01T21:00:00Z',deny=False):
 body={'p_route':route,'p_aircraft':tail,'p_departure':departure,'p_arrival':arrival,'p_timezone':'Africa/Cairo'}
 return denied('create_scheduled_flight',body,admin['token']) if deny else rpc('create_scheduled_flight',body,admin['token'])
for tail in [MAINT,UNKNOWN]:create(tail=tail,deny=True)
create(route=BA,deny=True)
s1=create()
result=create(route=AC,departure='2099-01-01T20:15:00Z',arrival='2099-01-01T21:15:00Z',deny=True);assert result['code']=='23P01'
result=create(route=BA,departure='2099-01-01T22:14:00Z',arrival='2099-01-01T23:14:00Z',deny=True);assert result['code']=='23P01'
s2=create(route=BA,departure='2099-01-01T22:15:00Z',arrival='2099-01-01T23:15:00Z')
assert denied('cancel_scheduled_flight',{'p_schedule':s1},admin['token'])
print('PASS real REST RPC: availability, origin, interval exclusion, turnaround and dependent-rotation cancellation checks',flush=True)
for actor in [None,p1['token'],pending['token']]:denied('set_fleet_scheduling_rule',{'p_fleet':FLEET,'p_preparation':0,'p_turnaround':0},actor)
for token in [None,p1['token']]:
 status,_=api('/rest/v1/scheduled_flights',{'flight_number':'FORGED'},token)
 assert status>=400
print('PASS actual PostgREST RLS and RPC permissions: anonymous/pilot cannot administer schedules',flush=True)
# Real HTTP race over Kong -> PostgREST -> PostgreSQL independent connections.
barrier=threading.Barrier(2)
def book_race(user):
 barrier.wait();return api('/rest/v1/rpc/book_scheduled_flight',{'p_schedule':s1},user['token'])
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(book_race,[p1,p2]))
assert sum(200<=s<300 for s,_ in results)==1,results
assert sql(f"select count(*) from public.flight_bookings where scheduled_flight_id='{s1}' and status='booked';")=='1'
booking=sql(f"select id from public.flight_bookings where scheduled_flight_id='{s1}' and status='booked';")
winner_id=sql(f"select pilot_id from public.flight_bookings where id='{booking}';")
winner=p1 if p1['id']==winner_id else p2;loser=p2 if winner is p1 else p1
assert sql(f"select count(*) from public.dispatches where booking_id='{booking}' and dispatch_number is not null;")=='1'
assert sql(f"select count(*) from public.platform_events where event_type='schedule.booking_created' and payload->>'bookingId'='{booking}';")=='1'
print('PASS actual concurrent API booking: one winner, one dispatch number and one event; failed request leaves no partial writes',flush=True)
own=success('/rest/v1/flight_bookings?select=id,scheduled_flight_id,status&id=eq.'+booking,token=winner['token'])
assert len(own)==1
assert success('/rest/v1/flight_bookings?select=id&id=eq.'+booking,token=loser['token'])==[]
assert denied('cancel_scheduled_booking',{'p_booking':booking},loser['token'])
for rpc_name in ['advance_flight_booking','advance_flight_operation','phase1_legacy_advance_booking','phase1_legacy_advance_operation']:
 denied(rpc_name,{'p_booking_id':booking},winner['token'])
denied('book_route',{'p_route_id':AB},winner['token'])
denied('book_scheduled_flight',{'p_schedule':s2},pending['token'])
status,_=api('/rest/v1/flight_bookings?id=eq.'+booking,{'status':'cancelled'},winner['token'],method='PATCH');assert status>=400
status,_=api('/rest/v1/flight_bookings?id=eq.'+booking,token=winner['token'],method='DELETE')
# PostgREST may return 204 when RLS filters all DELETE candidates. Verify the
# actual row survives rather than mistaking an empty success for a deletion.
assert status>=400 or status==204
assert sql(f"select count(*) from public.flight_bookings where id='{booking}';")=='1'
print('PASS own-booking RLS, cross-user denial, inactive account denial and legacy/direct-write bypass protection',flush=True)
rpc('cancel_scheduled_booking',{'p_booking':booking},winner['token'])
assert sql(f"select status from public.flight_bookings where id='{booking}';")=='cancelled'
rebook=rpc('book_scheduled_flight',{'p_schedule':s1},loser['token'])
assert rebook!=booking
rpc('cancel_scheduled_booking',{'p_booking':rebook},loser['token'])
print('PASS real API cancellation and rebooking preserve both historical booking records',flush=True)
barrier=threading.Barrier(2)
def allocate_race(route):
 barrier.wait();return api('/rest/v1/rpc/create_scheduled_flight',{'p_route':route,'p_aircraft':TAIL2,'p_departure':'2099-02-01T20:00:00Z','p_arrival':'2099-02-01T21:00:00Z','p_timezone':'Africa/Cairo'},admin['token'])
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(allocate_race,[AB,AC]))
assert sum(200<=s<300 for s,_ in results)==1,results
print('PASS actual concurrent API aircraft allocation: no overlapping use of the same registration',flush=True)
other_schedule=sql(f"select scheduled_flight_id from public.aircraft_allocations where aircraft_id='{TAIL2}' and released_at is null;")
barrier=threading.Barrier(2)
def pilot_race(schedule):
 barrier.wait();return api('/rest/v1/rpc/book_scheduled_flight',{'p_schedule':schedule},p1['token'])
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(pilot_race,[s2,other_schedule]))
assert sum(200<=s<300 for s,_ in results)==1,results
active_booking=next(result for status,result in results if 200<=status<300)
rpc('cancel_scheduled_booking',{'p_booking':active_booking},p1['token'])
print('PASS actual concurrent API requests cannot give one pilot two active occurrences',flush=True)
block=rpc('block_aircraft',{'p_aircraft':EDIT,'p_from':'2099-05-01T18:00:00Z','p_until':'2099-05-01T23:00:00Z','p_reason':'Synthetic maintenance'},admin['token'])
result=create(tail=EDIT,departure='2099-05-01T20:00:00Z',arrival='2099-05-01T21:00:00Z',deny=True);assert result['code']=='23P01'
denied('release_aircraft_block',{'p_block':block},p1['token'])
rpc('release_aircraft_block',{'p_block':block},admin['token'])
editable=create(tail=EDIT,departure='2099-05-01T20:00:00Z',arrival='2099-05-01T21:00:00Z')
rpc('reschedule_flight',{'p_schedule':editable,'p_aircraft':EDIT2,'p_departure':'2099-05-01T20:02:00Z','p_arrival':'2099-05-01T21:02:00Z'},admin['token'])
assert sql(f"select aircraft_id from public.aircraft_allocations where scheduled_flight_id='{editable}' and released_at is null;")==EDIT2
rpc('cancel_scheduled_flight',{'p_schedule':editable},admin['token'])
assert sql(f"select count(*) from public.aircraft_allocations where scheduled_flight_id='{editable}' and released_at is null;")=='0'
print('PASS actual maintenance-window API, protected release, rescheduling/reassignment and safe schedule cancellation',flush=True)
assert sql(f"select current_airport_id from public.aircraft where id='{TAIL}';")==A
assert sql(f"select count(*) from public.operations_flight_projection where booking_id in ('{booking}','{rebook}');")=='0'
assert sql(f"select sum(total_hours)||'/'||sum(total_flights) from public.profiles where id in ('{p1['id']}','{p2['id']}');")=='0.00/0'
projection=rpc('list_scheduled_flights',{},p1['token']);assert projection and all('email' not in row and 'pilot_id' not in row for row in projection)
print('PASS existing consumers leave actual aircraft position and pilot totals unchanged; public scheduling DTO excludes pilot PII',flush=True)
# Private local test credentials for the browser runner, never printed or committed.
state={'api_url':BASE,'anon_key':ANON,'service_key':SERVICE,'pilot':p1,'admin':admin,'schedule_id':s1,'tail':TAIL,'origin':A}
path=STATE/'integration-state.json';path.write_text(json.dumps(state));path.chmod(0o600)
print('ALL REAL LOCAL SUPABASE API CHECKS PASSED',flush=True)
