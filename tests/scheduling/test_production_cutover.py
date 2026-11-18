"""Prepared-OFF -> reviewed activation integration on real isolated Supabase.
No remote/production DSN accepted. Run on a fresh full-schema local test stack.
"""
import pathlib,json,subprocess,urllib.request,urllib.error,secrets,uuid,concurrent.futures,threading,time,sys
ROOT=pathlib.Path(__file__).resolve().parents[2];STATE=pathlib.Path('/workspace/kva-supabase-integration');DB='supabase_db_kva-supabase-integration'
info=json.loads(subprocess.check_output(['docker','inspect',DB]))[0];assert info['Config']['Labels'].get('kva.scope')=='real-supabase-integration'
gateway=json.loads(subprocess.check_output(['docker','inspect','kva-supabase-gateway']))[0];assert gateway['Config']['Labels'].get('kva.scope')=='real-supabase-integration'
config=json.loads((STATE/'local-status.json').read_text());BASE=config['API_URL'];assert BASE=='http://'+gateway['NetworkSettings']['Networks']['kva-real-supabase-test']['IPAddress']+':8000'
ANON=config['ANON_KEY'];SERVICE=config['SERVICE_ROLE_KEY'];opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
def sql(q,okay=True):
 p=subprocess.run(['docker','exec','-i',DB,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-U','postgres','-d','postgres'],input=q,text=True,capture_output=True,timeout=40)
 if okay:assert p.returncode==0,p.stderr;return p.stdout.strip()
 assert p.returncode!=0,'Expected rejection';return p.stderr

def api(path,body=None,token=None,service=False,method=None):
 key=SERVICE if service else ANON;r=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,headers={'apikey':key,'Authorization':'Bearer '+(token or key),'Content-Type':'application/json'},method=method)
 try:
  with opener.open(r,timeout=40) as response:
   raw=response.read();return response.status,json.loads(raw) if raw else None
 except urllib.error.HTTPError as e:
  raw=e.read()
  try:return e.code,json.loads(raw)
  except ValueError:return e.code,None

def rpc(name,body,token):
 status,result=api('/rest/v1/rpc/'+name,body,token);assert 200<=status<300,(name,status,result);return result

def deny(name,body,token=None):
 status,result=api('/rest/v1/rpc/'+name,body,token);assert status>=400,(name,status);return result

def account(role='pilot'):
 email='cutover-'+secrets.token_hex(5)+'@example.invalid';password=secrets.token_urlsafe(25)
 status,user=api('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,'user_metadata':{'full_name':'Synthetic cutover user'}},service=True);assert status==200
 actor=str(uuid.UUID(user['id']));sql(f"update profiles set role='{role}',status='active' where id='{actor}';")
 status,session=api('/auth/v1/token?grant_type=password',{'email':email,'password':password});assert status==200
 return {'id':actor,'token':session['access_token'],'email':email,'password':password}

def checksum(file):
 q=(ROOT/file).read_text()
 if 'foundation_backup' in file:q=q.replace('select payload as backup_payload,md5(payload::text) as backup_checksum','select md5(payload::text)')
 else:q=q.replace('select payload as backup_payload,md5(payload::text) as backup_checksum','select md5(payload::text)')
 value=sql(q);assert len(value)==32;return value

def schema_ready():
 sql("notify pgrst,'reload schema';")
 for _ in range(40):
  status,_=api('/rest/v1/rpc/scheduling_mode_enabled',{})
  if status==200:return
  time.sleep(.1)
 raise AssertionError('New RPC not in actual PostgREST cache')

def finish(booking,user):
 for expected in ['boarding','departed','enroute','landed','completed']:
  assert rpc('advance_flight_booking',{'p_booking_id':booking},user['token'])==expected

assert sql("select to_regnamespace('kva_scheduling_private') is null;")=='t','Reset disposable test schema first'
admin=account('admin');p1=account();p2=account()
A,B,C=sql('select id from airports order by icao_code limit 3;').splitlines()
F,L,TA,TB,TL,AB,BA,AC,LEG,LEGR=[str(uuid.uuid4()) for _ in range(10)]
sql(f"""
insert into fleet_types(id,icao_code,manufacturer,model,engine_count) values('{F}','CUT1','Test','Cutover',2),('{L}','CLG1','Test','Legacy',2);
insert into aircraft(id,registration,fleet_type_id,status,current_airport_id) values('{TA}','SU-CT1','{F}','active','{A}'),('{TB}','SU-CT2','{F}','active','{A}'),('{TL}','SU-CTL','{L}','active','{A}');
insert into routes(id,flight_number,departure_airport_id,arrival_airport_id,fleet_type_id,scheduled_minutes) values
('{AB}','KVC101','{A}','{B}','{F}',60),('{BA}','KVC102','{B}','{A}','{F}',60),('{AC}','KVC103','{A}','{C}','{F}',60),('{LEG}','KVL101','{A}','{B}','{L}',60),('{LEGR}','KVL102','{B}','{A}','{L}',60);
""")
original=json.loads(sql("select jsonb_agg(jsonb_build_object('oid',oid,'name',proname,'definition',pg_get_functiondef(oid),'acl',proacl::text) order by proname) from pg_proc where oid in ('public.book_route(uuid)'::regprocedure,'public.advance_flight_booking(uuid)'::regprocedure,'public.advance_flight_operation(uuid)'::regprocedure);"))
f=(ROOT/'supabase/production/20261118_scheduling_foundation.sql').read_text().replace('PASTE_BACKUP_CHECKSUM_HERE',checksum('supabase/review/20261118_scheduling_foundation_backup.sql'));sql(f)
prepare=(ROOT/'supabase/production/20261118_scheduling_cutover_prepare.sql').read_text();rollback=(ROOT/'supabase/production/20261118_scheduling_cutover_rollback.sql').read_text();activate=(ROOT/'supabase/production/20261118_scheduling_cutover_activate.sql').read_text()
if '--compact-copy' in sys.argv:
 import re
 prepare=pathlib.Path('/workspace/kva-scheduling-cutover-ready-compact.sql').read_text()
 prepare=re.sub(r"set local kva.cutover_backup_checksum='[a-f0-9]{32}';","set local kva.cutover_backup_checksum='PASTE_CUTOVER_BACKUP_CHECKSUM_HERE';",prepare)
def prepared():return prepare.replace('PASTE_CUTOVER_BACKUP_CHECKSUM_HERE',checksum('supabase/review/20261118_scheduling_cutover_backup.sql'))
assert 'backup missing' in sql(prepare,False)
assert sql("select to_regclass('kva_scheduling_private.cutover_backup') is null;")=='t'
fault=prepared().rsplit('commit;',1)[0]+"do $$begin raise exception 'Injected failure';end$$;commit;"
assert 'Injected failure' in sql(fault,False)
for item in original:assert sql(f"select oid from pg_proc where oid='public.{item['name']}(uuid)'::regprocedure;")==str(item['oid'])
print('PASS backup guard and injected failure preserve original routine identities/data atomically',flush=True)
assert 'cutover prepared OFF' in sql(prepared());schema_ready()
verification=sql((ROOT/'supabase/production/20261118_scheduling_cutover_verify.sql').read_text()).split('|')
assert verification[:3]==['prepared','f','f'] and verification[-4:]==['t','t','t','t']
assert rpc('scheduling_mode_enabled',{},p1['token']) is False
assert rpc('list_scheduled_flights',{},p1['token'])==[]
deny('book_scheduled_flight',{'p_schedule':str(uuid.uuid4())},p1['token'])
legacy=rpc('book_route',{'p_route_id':LEG},p2['token'])
assert sql(f"select count(*) from dispatches where booking_id='{legacy}';")=='1'
print('PASS prepared database stays OFF; actual legacy booking/dispatch still work; new booking is blocked',flush=True)
if '--browser-gates' in sys.argv:
 state=STATE/'cutover-browser-state.json';state.write_text(json.dumps({'api_url':BASE,'anon_key':ANON,'service_key':SERVICE,'pilot':p1,'admin':admin,'schedule_id':None,'tail':TA,'origin':A}));state.chmod(0o600)
 with open('/tmp/kva-cutover-browser-off.log','w') as output:
  child=subprocess.run([sys.executable,str(ROOT/'tests/scheduling/test_supabase_browser.py'),'--cutover','--prepared-only','--reuse-build'],cwd=ROOT,stdout=output,stderr=subprocess.STDOUT,timeout=180)
 assert child.returncode==0,'Prepared browser gate check failed: inspect /tmp/kva-cutover-browser-off.log'
 print('PASS real prepared-OFF browser matrix: premature application flag preserves legacy booking UI',flush=True)
assert 'original legacy routine identities' in sql(rollback)
for item in original:
 current=json.loads(sql(f"select jsonb_build_object('oid',oid,'definition',pg_get_functiondef(oid),'acl',proacl::text) from pg_proc where oid='public.{item['name']}(uuid)'::regprocedure;"))
 assert current['oid']==item['oid'] and current['definition']==item['definition'] and current['acl']==item['acl']
assert sql(f"select status from flight_bookings where id='{legacy}';")=='booked'
print('PASS empty prepared rollback restores exact legacy OIDs/definitions/grants and keeps a new real booking',flush=True)
sql(prepared());schema_ready()
assert 'Active legacy' in sql(activate,False)
rpc('set_fleet_scheduling_rule',{'p_fleet':F,'p_preparation':30,'p_turnaround':45},admin['token'])
def create(route=AB,tail=TA,depart='2099-01-01T20:00:00Z',arrive='2099-01-01T21:00:00Z'):
 return rpc('create_scheduled_flight',{'p_route':route,'p_aircraft':tail,'p_departure':depart,'p_arrival':arrive,'p_timezone':'Africa/Cairo'},admin['token'])
s1=create();s2=create(BA,TA,'2099-01-01T22:15:00Z','2099-01-01T23:15:00Z')
assert rpc('list_scheduled_flights',{},p1['token'])==[]
status,rows=api('/rest/v1/scheduled_flights?select=id',token=p1['token']);assert status==200 and rows==[]
assert 'New scheduling data exists' in sql(rollback,False)
finish(legacy,p2)
print('PASS existing legacy progress/completion still work while OFF; prepared plans stay hidden from pilots',flush=True)
# Activation must revalidate maintenance/location and never strand planned legs.
sql(f"update aircraft set status='maintenance' where id='{TA}';");assert 'Aircraft unavailable' in sql(activate,False);sql(f"update aircraft set status='active' where id='{TA}';")
sql(f"update aircraft set current_airport_id='{C}' where id='{TA}';");assert 'airport mismatch' in sql(activate,False);sql(f"update aircraft set current_airport_id='{A}' where id='{TA}';")
assert rpc('scheduling_mode_enabled',{},p1['token']) is False
print('PASS activation rejects busy legacy flights and changed aircraft readiness/location without enabling mode',flush=True)
# Hold the actual legacy HTTP booking in flight to prove shared/exclusive mode locking.
sql(f"""create function public.cutover_test_pause() returns trigger language plpgsql as $$begin if new.route_id='{LEGR}' then perform pg_sleep(0.8);end if;return new;end$$;
create trigger cutover_test_pause after insert on public.flight_bookings for each row execute function public.cutover_test_pause();""")
with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
 future=pool.submit(rpc,'book_route',{'p_route_id':LEGR},p2['token'])
 for _ in range(40):
  if sql("select exists(select 1 from pg_locks where locktype='advisory' and mode='ShareLock' and granted);")=='t':break
  time.sleep(.01)
 else:raise AssertionError('Legacy in-flight mode lock was not observed')
 assert 'Active legacy' in sql(activate,False)
 legacy_return=future.result()
sql('drop trigger cutover_test_pause on public.flight_bookings;drop function public.cutover_test_pause();')
finish(legacy_return,p2)
print('PASS real in-flight legacy API request cannot race activation: activation waits and refuses the committed active booking',flush=True)
assert 'scheduled_booking' in sql(activate)
verification=sql((ROOT/'supabase/production/20261118_scheduling_cutover_verify.sql').read_text()).split('|')
assert verification[:3]==['scheduled_booking','t','t'] and verification[-4:]==['t','t','t','t']
assert rpc('scheduling_mode_enabled',{},p1['token']) is True
before=sql('select count(*) from flight_bookings;')
deny('book_route',{'p_route_id':AB},p1['token'])
assert sql('select count(*) from flight_bookings;')==before
assert 'Scheduled occurrence' in sql(f"insert into flight_bookings(route_id,pilot_id,aircraft_id,status) values('{AB}','{p1['id']}','{TA}','booked');",False)
# Even archived definer routines invoked by an owner cannot bypass the global write guard.
assert 'Scheduled occurrence' in sql(f"set request.jwt.claim.sub='{p1['id']}';select kva_scheduling_private.legacy_book_route('{AB}');",False)
print('PASS activated mode rejects public/private/direct legacy booking bypasses without partial records',flush=True)
barrier=threading.Barrier(2)
def bookrace(user):barrier.wait();return api('/rest/v1/rpc/book_scheduled_flight',{'p_schedule':s1},user['token'])
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(bookrace,[p1,p2]))
assert sum(200<=status<300 for status,_ in results)==1,results
booking=next(data for status,data in results if 200<=status<300)
winner=p1 if sql(f"select pilot_id from flight_bookings where id='{booking}';")==p1['id'] else p2;other=p2 if winner is p1 else p1
deny('cancel_scheduled_booking',{'p_booking':booking},other['token']);rpc('cancel_scheduled_booking',{'p_booking':booking},winner['token'])
second=rpc('book_scheduled_flight',{'p_schedule':s1},other['token']);rpc('cancel_scheduled_booking',{'p_booking':second},other['token'])
assert sql(f"select count(*) from flight_bookings where scheduled_flight_id='{s1}' and status='cancelled';")=='2'
print('PASS actual scheduled booking race, own cancellation and rebooking preserve history after production-style cutover',flush=True)
barrier=threading.Barrier(2)
def allocaterace(route):barrier.wait();return api('/rest/v1/rpc/create_scheduled_flight',{'p_route':route,'p_aircraft':TB,'p_departure':'2099-02-01T20:00:00Z','p_arrival':'2099-02-01T21:00:00Z','p_timezone':'Africa/Cairo'},admin['token'])
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(allocaterace,[AB,AC]))
assert sum(200<=status<300 for status,_ in results)==1,results
assert sql(f"select current_airport_id from aircraft where id='{TA}';")==A
assert sql(f"select total_hours::text||'/'||total_flights from profiles where id='{p1['id']}';")=='0.00/0'
assert 'Only inactive prepared' in sql(rollback,False)
print('PASS shared aircraft resource race, unchanged actual position/hours and refusal of destructive post-activation rollback',flush=True)
# State for real browser gate checks; never committed or printed.
p=STATE/'cutover-browser-state.json';p.write_text(json.dumps({'api_url':BASE,'anon_key':ANON,'service_key':SERVICE,'pilot':p1,'admin':admin,'schedule_id':s1,'tail':TA,'origin':A,'flight_number':'KVC101','registration':'SU-CT1'}));p.chmod(0o600)
print('ALL PRODUCTION-STYLE CUTOVER CHECKS PASSED ON ISOLATED REAL SUPABASE',flush=True)
