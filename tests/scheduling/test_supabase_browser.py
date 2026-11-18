"""Real KVA -> real isolated Supabase Auth/PostgREST -> complete SQL schema.
No API mocking/interception and no production credentials. Run API suite first.
"""
import json
import os
import pathlib
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from playwright.sync_api import sync_playwright

ROOT=pathlib.Path(__file__).resolve().parents[2]
STATE=pathlib.Path('/workspace/kva-supabase-integration')
state=json.loads((STATE/'integration-state.json').read_text())
gateway=json.loads(subprocess.check_output(['docker','inspect','kva-supabase-gateway']))[0]
assert gateway['Config']['Labels'].get('kva.scope')=='real-supabase-integration'
ip=gateway['NetworkSettings']['Networks']['kva-real-supabase-test']['IPAddress']
assert state['api_url']=='http://'+ip+':8000'
base='http://localhost:3008'
urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))
env={k:v for k,v in os.environ.items() if not any(x in k.upper() for x in ['SUPABASE','KVA_','DATABASE_URL','DIRECT_URL','VERCEL','SMTP','IVAO'])}
env.update({'PATH':'/workspace/.onboarding:'+env['PATH'],'NEXT_PUBLIC_SUPABASE_URL':state['api_url'],
 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':state['anon_key'],'SUPABASE_SECRET_KEY':state['service_key'],
 'KVA_SCHEDULING_PHASE1_ENABLED':'true','NEXT_TELEMETRY_DISABLED':'1','NODE_USE_ENV_PROXY':'0',
 'NO_PROXY':'localhost,127.0.0.1,'+ip,'no_proxy':'localhost,127.0.0.1,'+ip})
log=open('/tmp/kva-real-supabase-web.log','a' if '--reuse-build' in sys.argv else 'w')
with socket.socket() as guard:
 guard.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
 guard.bind(('127.0.0.1',3008))  # Refuse stale/foreign servers before testing.
if '--reuse-build' not in sys.argv:
 subprocess.run(['pnpm','verify'],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,check=True,timeout=300)
process=subprocess.Popen(['pnpm','--filter','@kalabsha/web','start','--hostname','127.0.0.1','--port','3008'],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
def local_api(path,body=None,token=None):
 req=urllib.request.Request(state['api_url']+path,data=json.dumps(body).encode() if body is not None else None,
  headers={'apikey':state['anon_key'],'Authorization':'Bearer '+(token or state['pilot']['token']),'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=15) as response:
  data=response.read();return json.loads(data) if data else None
try:
 for _ in range(100):
  assert process.poll() is None,'Local web process exited before readiness'
  try:
   with urllib.request.urlopen(base+'/pilots/login',timeout=2) as response:
    if response.status==200:break
  except Exception:time.sleep(.2)
 else:raise AssertionError('Local KVA server not ready')
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
  context=browser.new_context()
  page=context.new_page();response=page.goto(base+'/pilot/schedule',wait_until='networkidle');assert '/pilots/login' in page.url
  context.close()
  print('PASS real web/Auth: anonymous schedule access redirects to login',flush=True)
  for locale in ['ar','en']:
   for width in [390,1440]:
    context=browser.new_context(viewport={'width':width,'height':950})
    context.add_cookies([{'name':'KVA_LOCALE','value':locale,'url':base}])
    page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(base+'/pilots/login',wait_until='networkidle')
    page.locator('input[name="email"]').fill(state['pilot']['email']);page.locator('input[name="password"]').fill(state['pilot']['password'])
    page.locator('form button[type="submit"]').click();page.wait_for_url('**/pilot/dashboard',wait_until='networkidle')
    page.goto(base+'/pilot/flights',wait_until='networkidle');assert page.url.endswith('/pilot/schedule')
    assert page.locator('h1').inner_text()==('الرحلات المجدولة' if locale=='ar' else 'Scheduled flights')
    assert page.locator('main').get_attribute('dir')==('rtl' if locale=='ar' else 'ltr')
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Horizontal overflow'
    card=page.locator('article').filter(has_text='KVT901').filter(has_text='SU-STG1');assert card.count()==1
    card.get_by_role('button',name='احجز الرحلة' if locale=='ar' else 'Book flight',exact=True).click()
    page.wait_for_url('**/pilot/schedule?message=booked',wait_until='networkidle')
    rows=local_api('/rest/v1/flight_bookings?select=id,status&scheduled_flight_id=eq.'+state['schedule_id']+'&status=eq.booked')
    assert len(rows)==1
    booking_id=rows[0]['id']
    # Real existing detail view, all FK joins/RLS/dispatch reads against Supabase.
    detail=page.goto(base+'/pilot/bookings/'+booking_id,wait_until='networkidle');assert detail.status==200
    assert 'KVT901' in page.locator('main').inner_text()
    assert page.get_by_role('button',name='Start Flight',exact=True).count()==0
    assert page.get_by_role('button',name='بدء الرحلة',exact=True).count()==0
    assert ('Scheduled flight execution is not available yet.' if locale=='en' else 'بدء تشغيل الرحلات المجدولة غير متاح حاليًا.') in page.locator('main').inner_text()
    page.goto(base+'/pilot/schedule',wait_until='networkidle')
    card=page.locator('article').filter(has_text='KVT901').filter(has_text='SU-STG1')
    card.get_by_role('button',name='إلغاء الحجز' if locale=='ar' else 'Cancel booking',exact=True).click()
    page.wait_for_url('**/pilot/schedule?message=cancelled',wait_until='networkidle')
    rows=local_api('/rest/v1/flight_bookings?select=id,status&id=eq.'+booking_id)
    assert len(rows)==1 and rows[0]['status']=='cancelled'
    assert not errors,errors
    context.close()
    print('PASS real Supabase browser flow:',locale,width,'password login, schedule, booking, detail, cancellation and history; no JS errors/overflow',flush=True)
  browser.close()
 print('ALL REAL SUPABASE BROWSER CHECKS PASSED',flush=True)
finally:
 if process.poll() is None:os.killpg(process.pid,signal.SIGTERM)
 process.wait(timeout=20);log.close()
