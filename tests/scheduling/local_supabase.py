"""Provision real local Supabase core services for scheduling tests only.
Uses official GoTrue/PostgREST/Kong images and PostgreSQL 17; no mock API.
Private configuration is outside Git. No remote database URL or token accepted.
"""
import json,pathlib,secrets,time,base64,hmac,hashlib,subprocess,urllib.request,sys
root=pathlib.Path('/workspace/kva-supabase-integration')
root.mkdir(mode=0o700,parents=True,exist_ok=True)
ROOT=pathlib.Path(__file__).resolve().parents[2]
network='kva-real-supabase-test'
def run(args,**kw):return subprocess.run(args,check=True,capture_output=True,text=True,**kw).stdout.strip()
def save(name,text):
 p=root/name;p.write_text(text);p.chmod(0o600)
def apply_repository_schema():
 container='supabase_db_kva-supabase-integration'
 info=json.loads(run(['docker','inspect',container]))[0]
 assert info['Config']['Labels'].get('kva.scope')=='real-supabase-integration'
 assert 'kva-real-supabase-test' in info['NetworkSettings']['Networks']
 applied=[]
 for path in sorted((ROOT/'supabase/migrations').glob('*.sql')):
  run(['docker','exec','-i',container,'psql','-X','-q','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],input=path.read_text())
  applied.append({'name':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
 save('applied-migrations.json',json.dumps(applied))
 print('Complete repository schema installed:',len(applied))

if '--reset-test-schema' in sys.argv:
 container='supabase_db_kva-supabase-integration'
 info=json.loads(run(['docker','inspect',container]))[0]
 assert info['Config']['Labels'].get('kva.scope')=='real-supabase-integration'
 assert 'kva-real-supabase-test' in info['NetworkSettings']['Networks']
 run(['docker','exec','-i',container,'psql','-X','-q','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],input="""
 drop schema public cascade;create schema public authorization postgres;
 grant usage on schema public to anon,authenticated,service_role,authenticator,supabase_auth_admin;
 alter default privileges for role postgres in schema public grant all on tables to anon,authenticated,service_role;
 alter default privileges for role postgres in schema public grant all on sequences to anon,authenticated,service_role;
 alter default privileges for role postgres in schema public grant all on functions to anon,authenticated,service_role;
 """)
 apply_repository_schema()
 raise SystemExit(0)

# Refuse to overwrite the private keys of an existing test stack.
existing=subprocess.run(['docker','inspect','supabase_db_kva-supabase-integration'],capture_output=True)
if existing.returncode==0:raise SystemExit('Test stack exists; use --reset-test-schema for synthetic public data only')
secret=secrets.token_urlsafe(48);dbpassword=secrets.token_urlsafe(24);authpassword=secrets.token_urlsafe(24)
def jwt(role):
 enc=lambda obj:base64.urlsafe_b64encode(json.dumps(obj,separators=(',',':')).encode()).decode().rstrip('=')
 head=enc({'alg':'HS256','typ':'JWT'});body=enc({'role':role,'iss':'supabase','iat':int(time.time()),'exp':int(time.time())+86400*30});raw=head+'.'+body
 return raw+'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),raw.encode(),hashlib.sha256).digest()).decode().rstrip('=')
anon=jwt('anon');service=jwt('service_role')
save('local-status.json',json.dumps({'API_URL':'http://127.0.0.1:55431','ANON_KEY':anon,'SERVICE_ROLE_KEY':service}))
save('auth.env','\n'.join([f'GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:{authpassword}@db:5432/postgres',
'GOTRUE_DB_DRIVER=postgres','GOTRUE_DB_NAMESPACE=auth','GOTRUE_API_HOST=0.0.0.0','GOTRUE_API_PORT=9999',
'API_EXTERNAL_URL=http://127.0.0.1:55431','GOTRUE_SITE_URL=http://localhost:3008','GOTRUE_URI_ALLOW_LIST=http://localhost:3008/**',
f'GOTRUE_JWT_SECRET={secret}','GOTRUE_JWT_EXP=7200','GOTRUE_JWT_ADMIN_ROLES=service_role','GOTRUE_JWT_AUD=authenticated','GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated',
'GOTRUE_DISABLE_SIGNUP=true','GOTRUE_EXTERNAL_EMAIL_ENABLED=true','GOTRUE_MAILER_AUTOCONFIRM=true'])+'\n')
save('rest.env',f'PGRST_DB_URI=postgres://authenticator:{dbpassword}@db:5432/postgres\nPGRST_DB_SCHEMAS=public\nPGRST_DB_EXTRA_SEARCH_PATH=public,extensions\nPGRST_DB_ANON_ROLE=anon\nPGRST_JWT_SECRET={secret}\nPGRST_LOG_LEVEL=warn\n')
save('kong.yml',f'''_format_version: '2.1'
consumers:
  - username: anonymous
    keyauth_credentials:
      - key: {anon}
  - username: service
    keyauth_credentials:
      - key: {service}
services:
  - name: auth
    url: http://auth:9999/
    routes:
      - name: auth-route
        paths: [/auth/v1/]
        strip_path: true
    plugins:
      - name: key-auth
        config:
          key_names: [apikey]
          hide_credentials: false
      - name: cors
  - name: rest
    url: http://rest:3000/
    routes:
      - name: rest-route
        paths: [/rest/v1/]
        strip_path: true
    plugins:
      - name: key-auth
        config:
          key_names: [apikey]
          hide_credentials: false
      - name: cors
''')
run(['docker','network','create','--internal',network])
run(['docker','run','-d','--name','supabase_db_kva-supabase-integration','--network',network,'--network-alias','db',
'--label','com.supabase.cli.project=kva-supabase-integration','--label','kva.scope=real-supabase-integration',
'--tmpfs','/var/lib/postgresql/data:rw','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine'])
for _ in range(60):
 p=subprocess.run(['docker','exec','supabase_db_kva-supabase-integration','pg_isready','-U','postgres'],capture_output=True)
 if p.returncode==0:break
 time.sleep(.2)
setup=f'''
create role anon nologin noinherit;create role authenticated nologin noinherit;create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit password '{dbpassword}';grant anon,authenticated,service_role to authenticator;
create role supabase_auth_admin login noinherit createrole password '{authpassword}';
create schema auth authorization supabase_auth_admin;create schema extensions;
alter role supabase_auth_admin set search_path=auth,public,extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema public,auth,extensions to anon,authenticated,service_role,authenticator,supabase_auth_admin;
alter default privileges for role postgres in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon,authenticated,service_role;
alter default privileges for role postgres in schema public grant all on functions to anon,authenticated,service_role;
'''
run(['docker','exec','-i','supabase_db_kva-supabase-integration','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],input=setup)
for name,image,env,alias in [('kva-supabase-auth','supabase/gotrue:v2.180.0','auth.env','auth'),('kva-supabase-rest','postgrest/postgrest:v12.2.12','rest.env','rest')]:
 run(['docker','run','-d','--name',name,'--network',network,'--network-alias',alias,'--label','kva.scope=real-supabase-integration','--env-file',str(root/env),image])
# Docker reads the private declarative file via bind mount; Kong runs as root only
# inside this throwaway internal-network test container so 0600 config is readable.
run(['docker','run','-d','--name','kva-supabase-gateway','--network',network,'--label','kva.scope=real-supabase-integration','--user','0',
'-v',str(root/'kong.yml')+':/tmp/kong.yml:ro','-e','KONG_DATABASE=off','-e','KONG_DECLARATIVE_CONFIG=/tmp/kong.yml',
'-e','KONG_PROXY_LISTEN=0.0.0.0:8000','-e','KONG_ADMIN_LISTEN=off','-e','KONG_NGINX_WORKER_PROCESSES=1','kong:2.8.1'])
gateway=json.loads(run(['docker','inspect','kva-supabase-gateway']))[0]
ip=gateway['NetworkSettings']['Networks'][network]['IPAddress']
base='http://'+ip+':8000'
save('local-status.json',json.dumps({'API_URL':base,'ANON_KEY':anon,'SERVICE_ROLE_KEY':service}))
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
for _ in range(100):
 try:
  with opener.open(urllib.request.Request(base+'/auth/v1/health',headers={'apikey':anon}),timeout=2) as response:
   if response.status==200:break
 except Exception:time.sleep(.2)
else:raise RuntimeError('Official Auth service failed readiness; inspect local container logs')
print('Official Auth/PostgREST/Kong and PostgreSQL ready on private internal bridge; no ports published.')

apply_repository_schema()
