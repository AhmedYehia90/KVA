"""Production-foundation checks on the isolated REAL Supabase stack only.
Never accepts a hosted URL or DSN. No production data is loaded.
"""
import json,pathlib,subprocess,urllib.request,urllib.error,secrets,uuid
ROOT=pathlib.Path(__file__).resolve().parents[2]
STATE=pathlib.Path('/workspace/kva-supabase-integration')
DB='supabase_db_kva-supabase-integration'
info=json.loads(subprocess.check_output(['docker','inspect',DB]))[0]
assert info['Config']['Labels'].get('kva.scope')=='real-supabase-integration'
assert 'kva-real-supabase-test' in info['NetworkSettings']['Networks']
gateway=json.loads(subprocess.check_output(['docker','inspect','kva-supabase-gateway']))[0]
assert gateway['Config']['Labels'].get('kva.scope')=='real-supabase-integration'
address=gateway['NetworkSettings']['Networks']['kva-real-supabase-test']['IPAddress']
config=json.loads((STATE/'local-status.json').read_text())
BASE=config['API_URL'];assert BASE=='http://'+address+':8000'
ANON=config['ANON_KEY'];SERVICE=config['SERVICE_ROLE_KEY']
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
def sql(text,okay=True):
 p=subprocess.run(['docker','exec','-i',DB,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-U','postgres','-d','postgres'],input=text,text=True,capture_output=True,timeout=40)
 if okay:assert p.returncode==0,p.stderr;return p.stdout.strip()
 assert p.returncode!=0,'Expected transaction rejection'
 return p.stderr

def api(path,body=None,token=None,service=False,method=None):
 key=SERVICE if service else ANON
 r=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,
  headers={'apikey':key,'Authorization':'Bearer '+(token or key),'Content-Type':'application/json'},method=method)
 try:
  with opener.open(r,timeout=30) as response:
   data=response.read();return response.status,json.loads(data) if data else None
 except urllib.error.HTTPError as error:
  data=error.read()
  try:return error.code,json.loads(data)
  except ValueError:return error.code,None

def account():
 email='foundation-'+secrets.token_hex(5)+'@example.invalid';password=secrets.token_urlsafe(25)
 status,user=api('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,'user_metadata':{'full_name':'Synthetic foundation pilot'}},service=True)
 assert status==200,(status,user)
 actor=str(uuid.UUID(user['id']));sql(f"update public.profiles set status='active' where id='{actor}';")
 status,data=api('/auth/v1/token?grant_type=password',{'email':email,'password':password});assert status==200
 return actor,data['access_token']

assert sql("select to_regclass('public.scheduled_flights') is null;")=='t','Use a fresh full-schema test database'
actor,token=account();fleet=str(uuid.uuid4());tail=str(uuid.uuid4());route=str(uuid.uuid4())
airports=sql('select id from public.airports order by icao_code limit 2;').splitlines();assert len(airports)==2
sql(f"""
insert into public.fleet_types(id,icao_code,manufacturer,model,engine_count) values('{fleet}','FND1','Test','Foundation only',2);
insert into public.aircraft(id,registration,fleet_type_id,status,current_airport_id) values('{tail}','SU-FND1','{fleet}','active','{airports[0]}');
insert into public.routes(id,flight_number,departure_airport_id,arrival_airport_id,fleet_type_id,scheduled_minutes) values('{route}','KVT-FND1','{airports[0]}','{airports[1]}','{fleet}',60);
insert into public.flight_bookings(route_id,pilot_id,aircraft_id,status,booked_at) values('{route}','{actor}','{tail}','completed','2025-01-01 00:00+00');
""")
backup=(ROOT/'supabase/review/20261118_scheduling_foundation_backup.sql').read_text()
backup=backup.replace('select payload as backup_payload,md5(payload::text) as backup_checksum','select jsonb_build_object(\'payload\',payload,\'checksum\',md5(payload::text))')
def baseline():return json.loads(sql(backup))
original=baseline();assert original['payload']['bookings']
private=STATE/'foundation-backup-test.json';private.write_text(json.dumps(original));private.chmod(0o600)
install=(ROOT/'supabase/production/20261118_scheduling_foundation.sql').read_text()
rollback=(ROOT/'supabase/production/20261118_scheduling_foundation_rollback.sql').read_text()
def prepared(checksum):return install.replace('PASTE_BACKUP_CHECKSUM_HERE',checksum)
assert 'Backup checksum' in sql(install,False)
assert 'Backup checksum' in sql(prepared('0'*32),False)
assert baseline()==original
print('PASS missing/wrong backup fingerprint rejected with no schema or data change',flush=True)
# A changed booking after export makes the old fingerprint invalid.
sql(f"update public.flight_bookings set booked_at=booked_at+interval '1 second' where route_id='{route}';")
assert 'baseline changed' in sql(prepared(original['checksum']),False)
sql(f"update public.flight_bookings set booked_at='2025-01-01 00:00+00',updated_at=created_at where route_id='{route}';")
# The update timestamp legitimately changed: export a new snapshot instead of
# assuming or rewriting a prior snapshot is still valid.
original=baseline();private.write_text(json.dumps(original))
print('PASS stale backup is rejected after a real concurrent data change',flush=True)
# Failure after DDL must unwind every new object and field in the transaction.
fault=prepared(original['checksum']).rsplit('commit;',1)[0]+"do $$begin raise exception 'Injected failure';end$$;commit;"
assert 'Injected failure' in sql(fault,False)
assert sql("select to_regclass('public.scheduled_flights') is null;")=='t'
assert sql("select count(*) from pg_attribute where attrelid='public.flight_bookings'::regclass and attname='scheduled_flight_id' and not attisdropped;")=='0'
assert baseline()==original
print('PASS forced post-DDL failure rolls back every schema/data change atomically',flush=True)
assert 'PASS: foundation installed' in sql(prepared(original['checksum']))
actual=json.loads(sql("select jsonb_agg(to_jsonb(b)-'scheduled_flight_id' order by id) from public.flight_bookings b;"))
assert actual==original['payload']['bookings']
for item in original['payload']['legacy_functions']:
 current=json.loads(sql("select jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl::text) from pg_proc p where p.oid='"+item['signature']+"'::regprocedure;"))
 assert current['definition']==item['definition'] and current['acl']==item['acl']
assert sql('select scheduling_enabled from kva_scheduling_private.foundation_manifest;')=='f'
assert '23514' in sql('update kva_scheduling_private.foundation_manifest set scheduling_enabled=true;',False)
print('PASS correct backup installs foundation; every old booking field/function/EXECUTE grant preserved; activation forced OFF',flush=True)
verification=sql((ROOT/'supabase/production/20261118_scheduling_foundation_verify.sql').read_text()).split('|')
assert len(verification)==9 and verification[:3]==['1','foundation','f'] and verification[4:]==['0','0','0','0','t']
print('PASS read-only operator verification confirms OFF, empty new tables and unchanged routines/permissions',flush=True)
assert 'already present' in sql(prepared(original['checksum']),False)
print('PASS accidental repeat application refused without resetting the installed schema',flush=True)
for role in ['anon','authenticated','service_role']:
 assert sql(f"select has_schema_privilege('{role}','kva_scheduling_private','USAGE');")=='f'
 for table in ['fleet_scheduling_rules','scheduled_flights','aircraft_allocations']:
  assert sql(f"select has_table_privilege('{role}','public.{table}','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER');")=='f'
for table in ['scheduled_flights','aircraft_allocations','fleet_scheduling_rules']:
 status,_=api('/rest/v1/'+table+'?select=*',token=token);assert status in [401,403,404],status
assert sql("select to_regprocedure('public.book_scheduled_flight(uuid)') is null;")=='t'
print('PASS real PostgREST/role checks: no new table access/RPC bypass; private backup manifest inaccessible',flush=True)
# This is the ACTUAL legacy RPC via Auth -> Kong -> PostgREST -> full schema.
status,booking=api('/rest/v1/rpc/book_route',{'p_route_id':route},token=token)
assert status==200,(status,booking);booking=str(uuid.UUID(booking))
status,rows=api('/rest/v1/flight_bookings?select=id,status,scheduled_flight_id&id=eq.'+booking,token=token)
assert status==200 and len(rows)==1 and rows[0]['status']=='booked' and rows[0]['scheduled_flight_id'] is None
assert sql(f"select count(*) from public.dispatches where booking_id='{booking}';")=='1'
print('PASS real pre-existing book_route and dispatch workflow continue after foundation install',flush=True)
# Rollback must refuse to destroy even a rule row; no override/CASCADE path exists.
sql(f"insert into public.fleet_scheduling_rules values('{fleet}',30,45);")
assert 'refusing destructive rollback' in sql(rollback,False)
assert sql('select count(*) from public.fleet_scheduling_rules;')=='1'
sql(f"delete from public.fleet_scheduling_rules where fleet_type_id='{fleet}';")
print('PASS rollback refuses nonempty new tables without losing their data',flush=True)
current_bookings=json.loads(sql('select jsonb_agg(to_jsonb(b)-\'scheduled_flight_id\' order by id) from public.flight_bookings b;'))
assert len(current_bookings)==len(original['payload']['bookings'])+1
assert 'PASS: inactive foundation removed' in sql(rollback)
assert sql("select to_regclass('public.scheduled_flights') is null and to_regnamespace('kva_scheduling_private') is null;")=='t'
assert json.loads(sql('select jsonb_agg(to_jsonb(b) order by id) from public.flight_bookings b;'))==current_bookings
for item in original['payload']['legacy_functions']:
 assert sql("select pg_get_functiondef('"+item['signature']+"'::regprocedure);")==item['definition'].strip()
status,rows=api('/rest/v1/flight_bookings?select=id,status&id=eq.'+booking,token=token)
assert status==200 and len(rows)==1
print('PASS successful rollback preserves ALL current legacy bookings, including the one made after installation',flush=True)
status,_=api('/auth/v1/logout?scope=local',token=token,method='POST');assert status==204
print('ALL PRODUCTION FOUNDATION CHECKS PASSED ON ISOLATED REAL SUPABASE',flush=True)
