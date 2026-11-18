"""Browser checks against a LOCAL Auth/PostgREST adapter and isolated PostgreSQL.
No production keys/accounts. Run test_phase1.py first. Adapter is test-only, not a service.
"""
import base64
import http.server
import json
import os
import pathlib
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
import uuid
from playwright.sync_api import sync_playwright

ROOT=pathlib.Path(__file__).resolve().parents[2]
CONTAINER='kva-scheduling-phase1'
info=json.loads(subprocess.check_output(['docker','inspect',CONTAINER]))[0]
assert info['Config']['Labels'].get('kva.scope')=='isolated-scheduling-test'
assert info['HostConfig']['NetworkMode']=='none' and not info['HostConfig'].get('PortBindings')
USER=str(uuid.UUID(int=99));ADMIN=str(uuid.UUID(int=1));TAIL=str(uuid.UUID(int=80));A=str(uuid.UUID(int=10));FLEET=str(uuid.UUID(int=20));ROUTE=str(uuid.UUID(int=40))
def sql(source,actor=USER,role='authenticated'):
 p=subprocess.run(['docker','exec','-i',CONTAINER,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','kva_phase1_test'],input=f"set request.jwt.claim.sub='{actor}';set role {role};"+source,text=True,capture_output=True,timeout=20)
 if p.returncode:raise RuntimeError('Isolated SQL request rejected')
 return p.stdout.strip()
sql(f"insert into profiles(id,status,role) values('{USER}','active','pilot');insert into aircraft values('{TAIL}','SU-WEBTEST','{FLEET}','active','{A}');",role='postgres')
SCHEDULE=sql(f"select create_scheduled_flight('{ROUTE}','{TAIL}','2099-03-01 20:00+00','2099-03-01 21:00+00','Africa/Cairo');",actor=ADMIN)
user={'id':USER,'aud':'authenticated','role':'authenticated','email':'stage@example.invalid','app_metadata':{'provider':'email','providers':['email']},'user_metadata':{},'created_at':'2026-01-01T00:00:00Z'}
def b64(value):return base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).decode().rstrip('=')
token=b64({'alg':'HS256','typ':'JWT'})+'.'+b64({'sub':USER,'aud':'authenticated','role':'authenticated','exp':int(time.time())+7200,'iat':int(time.time())})+'.local-test-signature'
session={'access_token':token,'refresh_token':'isolated-test-only','token_type':'bearer','expires_in':7200,'expires_at':int(time.time())+7200,'user':user}
class Handler(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def reply(self,data,status=200):
  body=json.dumps(data).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
 def do_GET(self):
  try:
   if self.path.startswith('/auth/v1/user'):return self.reply(user)
   if self.path.startswith('/rest/v1/profiles'):return self.reply({'callsign':'STAGE099','role':'pilot','status':'active'})
   if self.path.startswith('/rest/v1/flight_bookings'):
    return self.reply(json.loads(sql(f"select coalesce(json_agg(b),'[]'::json) from (select id,scheduled_flight_id,status from flight_bookings where pilot_id='{USER}' and status in ('booked','boarding','departed','enroute','landed')) b;")))
   return self.reply({'error':'Unsupported isolated endpoint'},404)
  except Exception:return self.reply({'error':'Isolated backend failure'},500)
 def do_POST(self):
  try:
   data=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or b'{}')
   if self.path=='/rest/v1/rpc/list_scheduled_flights':return self.reply(json.loads(sql("select coalesce(json_agg(s),'[]'::json) from list_scheduled_flights() s;")))
   if self.path=='/rest/v1/rpc/book_scheduled_flight':
    sid=str(uuid.UUID(data['p_schedule']));return self.reply(sql(f"select book_scheduled_flight('{sid}');"))
   if self.path=='/rest/v1/rpc/cancel_scheduled_booking':
    bid=str(uuid.UUID(data['p_booking']));sql(f"select cancel_scheduled_booking('{bid}');");return self.reply(None)
   return self.reply({'error':'Unsupported isolated endpoint'},404)
  except Exception:return self.reply({'code':'P0001','message':'Isolated request rejected'},400)
server=http.server.ThreadingHTTPServer(('127.0.0.1',54329),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
# Remove all supplied application credentials, then inject only synthetic local ones.
env={k:v for k,v in os.environ.items() if not any(x in k.upper() for x in ['SUPABASE','KVA_','DATABASE_URL','DIRECT_URL','VERCEL','SMTP','IVAO'])}
env.update({'PATH':'/workspace/.onboarding:'+env['PATH'],'NEXT_PUBLIC_SUPABASE_URL':'http://localhost:54329','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':'isolated-public-key','KVA_SCHEDULING_PHASE1_ENABLED':'true','NEXT_TELEMETRY_DISABLED':'1'})
log=open('/tmp/kva-phase1-web.log','a' if '--reuse-build' in sys.argv else 'w')
try:
 if '--reuse-build' not in sys.argv:
  subprocess.run(['pnpm','verify'],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,check=True,timeout=300)
 process=subprocess.Popen(['pnpm','--filter','@kalabsha/web','start','--hostname','127.0.0.1','--port','3006'],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT)
 try:
  ready=False
  for _ in range(100):
   try:
    with urllib.request.urlopen('http://localhost:3006/pilots/login',timeout=2) as response:ready=response.status==200
    if ready:break
   except Exception:time.sleep(.2)
  assert ready,'Local web server did not become ready'
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
   for locale in ['ar','en']:
    for width in [390,1440]:
     context=browser.new_context(viewport={'width':width,'height':950})
     context.add_cookies([{'name':'KVA_LOCALE','value':locale,'url':'http://localhost:3006'}, {'name':'sb-localhost-auth-token','value':'base64-'+b64(session),'url':'http://localhost:3006'}])
     page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
     page.goto('http://localhost:3006/pilot/schedule',wait_until='networkidle')
     assert page.locator('h1').inner_text()==('الرحلات المجدولة' if locale=='ar' else 'Scheduled flights'), (page.url,page.locator('h1').inner_text())
     assert page.locator('main').get_attribute('dir')==('rtl' if locale=='ar' else 'ltr')
     assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Horizontal overflow'
     assert page.get_by_text('SU-WEBTEST',exact=False).count()>=1
     assert not errors,errors
     print('PASS browser schedule',locale,width,'no overflow or JavaScript errors',flush=True)
     context.close()
   context=browser.new_context()
   context.add_cookies([{'name':'KVA_LOCALE','value':'en','url':'http://localhost:3006'}, {'name':'sb-localhost-auth-token','value':'base64-'+b64(session),'url':'http://localhost:3006'}])
   page=context.new_page();page.goto('http://localhost:3006/pilot/flights',wait_until='networkidle');assert page.url.endswith('/pilot/schedule')
   card=page.locator('article').filter(has_text='SU-WEBTEST')
   card.get_by_role('button',name='Book flight',exact=True).click();page.wait_for_url('**/pilot/schedule?message=booked')
   assert sql(f"select count(*) from flight_bookings where scheduled_flight_id='{SCHEDULE}' and pilot_id='{USER}' and status='booked';",role='postgres')=='1'
   card=page.locator('article').filter(has_text='SU-WEBTEST');card.get_by_role('button',name='Cancel booking',exact=True).click();page.wait_for_url('**/pilot/schedule?message=cancelled')
   assert sql(f"select count(*) from flight_bookings where scheduled_flight_id='{SCHEDULE}' and status='cancelled';",role='postgres')=='1'
   print('PASS browser legacy-list redirect, real staged booking/cancellation and preserved booking history',flush=True)
   context.close();browser.close()
  disabled_env=dict(env,KVA_SCHEDULING_PHASE1_ENABLED='false')
  disabled=subprocess.Popen(['pnpm','--filter','@kalabsha/web','start','--hostname','127.0.0.1','--port','3007'],cwd=ROOT,env=disabled_env,stdout=log,stderr=subprocess.STDOUT)
  try:
   import urllib.error
   observed=False
   for _ in range(60):
    try:
     urllib.request.urlopen('http://localhost:3007/pilot/schedule',timeout=2)
    except urllib.error.HTTPError as error:
     assert error.code==404;observed=True;break
    except OSError:time.sleep(.2)
   assert observed,'Disabled schedule route was not hidden'
   print('PASS feature disabled: schedule route is 404',flush=True)
  finally:
   disabled.terminate();disabled.wait(timeout=20)
 finally:
  process.terminate();process.wait(timeout=20)
finally:
 server.shutdown();log.close()
