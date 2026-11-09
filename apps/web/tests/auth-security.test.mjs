import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const directory = dirname(fileURLToPath(import.meta.url));
function load(relative, imports = {}, env = {}) {
  const code = ts.transpileModule(readFileSync(join(directory, relative), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  const exports = {};
  runInNewContext(code, {exports, URL, process: {env}, require: name => {
    if (!(name in imports)) throw new Error('Unexpected module: ' + name);
    return imports[name];
  }});
  return exports;
}
const security = load('../lib/auth/security.ts');
const unsafe = ['.example.invalid', '@example.invalid', 'https://example.invalid', '//example.invalid', '/\\example.invalid', '\\example.invalid', '/%2fexample.invalid', '/%5cexample.invalid', '/%252fexample.invalid', '/%25252fexample.invalid', '/%252e%252e//example.invalid', 'javascript:alert(1)', ' /pilot/dashboard', '/pilot/\nfoo', '/%0d%0aLocation:bad', '/%zz'];
test('canonical callback destinations reject external, encoded, malformed and control-character redirects', () => {
  for (const path of unsafe) assert.equal(security.safeAuthPath(path), '/pilot/dashboard', path);
  for (const path of ['/', '/pilot/dashboard', '/pilots/reset-password', '/pilot/flights?booking=123#details']) assert.equal(security.safeAuthPath(path), path);
});

function callback(exchange) {
  return load('../app/auth/callback/route.ts', {
    'next/server': {NextResponse: {redirect: url => ({status: 307, location: url.toString()})}},
    '@/lib/supabase/server': {createClient: async () => ({auth: {exchangeCodeForSession: exchange}})},
    '@/lib/auth/security': security,
  }).GET;
}
test('callback rejects missing/failed/provider-error exchanges without redirecting outside the origin', async () => {
  let called = 0;
  const get = callback(async () => {called++;return {error: null};});
  for (const query of ['?next=@example.invalid','?error=access_denied&code=unused','']) {
    const result = await get(new Request('https://kva-web-beta.vercel.app/auth/callback'+query));
    assert.equal(result.location, 'https://kva-web-beta.vercel.app/pilots/login?error=callback');
  }
  assert.equal(called, 0);
  for (const exchange of [async () => ({error: {message: 'private detail'}}), async () => {throw new Error('private network detail');}]) {
    const result = await callback(exchange)(new Request('https://kva-web-beta.vercel.app/auth/callback?code=test'));
    assert.equal(result.location, 'https://kva-web-beta.vercel.app/pilots/login?error=callback');
  }
});
test('successful exchange permits recovery path and falls back safely for attacker destinations', async () => {
  const get = callback(async () => ({error: null}));
  for (const path of unsafe) {
    const result = await get(new Request('https://kva-web-beta.vercel.app/auth/callback?code=test&next='+encodeURIComponent(path)));
    assert.equal(result.location,'https://kva-web-beta.vercel.app/pilot/dashboard');
  }
  assert.equal((await get(new Request('https://kva-web-beta.vercel.app/auth/callback?code=test&next=%2Fpilots%2Freset-password'))).location, 'https://kva-web-beta.vercel.app/pilots/reset-password');
});
test('sign-in failures distinguish throttling and outages without displaying provider details', () => {
  assert.equal(security.signInFailure({status: 400,code:'invalid_credentials'}),'invalid');
  assert.equal(security.signInFailure({status: 429}),'limited');
  assert.equal(security.signInFailure({status: 503}),'unavailable');
  assert.equal(security.signInFailure({}),'unavailable');
});
test('server email and password constraints reject malformed/weak/mismatched inputs', () => {
  assert.equal(security.validEmail('pilot@example.invalid'), true);
  for (const email of ['bad','a@b','a b@example.invalid','a@b@example.invalid']) assert.equal(security.validEmail(email), false);
  assert.equal(security.validNewPassword('long test passphrase','long test passphrase'),true);
  for (const [password,confirm] of [['short','short'],['            ','            '],['long test passphrase','different']]) assert.equal(security.validNewPassword(password,confirm),false);
});

const redirect = path => {const error=new Error('REDIRECT');error.path=path;throw error;};
function actions(relative, auth, env = {}) {
  return load(relative, {'next/navigation': {redirect}, '@/lib/supabase/server': {createClient: async()=>({auth})}, '@/lib/auth/security': security}, env);
}
function form(values) {const result=new FormData();for(const [key,value] of Object.entries(values))result.set(key,value);return result;}
test('login validates before SDK calls and produces correct success/outage destinations', async () => {
  let calls=0;
  const input=form({email:'pilot@example.invalid',password:'existing password'});
  for(const [error,path] of [[null,'/pilot/dashboard'],[{status:503},'/pilots/login?error=unavailable'],[{status:429},'/pilots/login?error=limited'],[{status:400},'/pilots/login?error=invalid']]) {
    const {login}=actions('../app/pilots/login/actions.ts',{signInWithPassword:async()=>{calls++;return {error};}});
    await assert.rejects(login(input),e=>e.path===path);
  }
  const before=calls;const {login}=actions('../app/pilots/login/actions.ts',{signInWithPassword:async()=>{calls++;return {error:null};}});
  await assert.rejects(login(form({email:'not-email',password:'test'})),e=>e.path==='/pilots/login?error=invalid');assert.equal(calls,before);
});
test('recovery does not enumerate addresses, and server errors do not pretend email was sent', async () => {
  let options;
  for(const error of [null,{status:400,code:'user_not_found'}]) {
    const {requestPasswordReset}=actions('../app/pilots/forgot-password/actions.ts',{resetPasswordForEmail:async(_email,value)=>{options=value;return {error};}}, {KVA_PASSWORD_RECOVERY_ENABLED:'true'});
    await assert.rejects(requestPasswordReset(form({email:'pilot@example.invalid'})),e=>e.path==='/pilots/forgot-password?message=sent');
  }
  assert.equal(new URL(options.redirectTo).origin,'https://kva-web-beta.vercel.app');
  const {requestPasswordReset}=actions('../app/pilots/forgot-password/actions.ts',{resetPasswordForEmail:async()=>({error:{status:503}})}, {KVA_PASSWORD_RECOVERY_ENABLED:'true'});
  await assert.rejects(requestPasswordReset(form({email:'pilot@example.invalid'})),e=>e.path==='/pilots/forgot-password?error=unavailable');
});
test('password update requires a real authenticated session and revokes sessions after success', async () => {
  const input=form({password:'long test passphrase',confirmation:'long test passphrase'});let writes=0,signedOut=false;
  const anonymous=actions('../app/pilots/reset-password/actions.ts',{getUser:async()=>({data:{user:null}}),updateUser:async()=>{writes++;return {error:null};}});
  await assert.rejects(anonymous.resetPassword(input),e=>e.path==='/pilots/login?error=callback');assert.equal(writes,0);
  const owner=actions('../app/pilots/reset-password/actions.ts',{getUser:async()=>({data:{user:{id:'owner'}}}),updateUser:async()=>{writes++;return {error:null};},signOut:async options=>{signedOut=options.scope==='global';return {error:null};}});
  await assert.rejects(owner.resetPassword(input),e=>e.path==='/pilots/login?message=password-updated');assert.equal(writes,1);assert.equal(signedOut,true);
});

test('operations access requires email allowlist plus active database staff role, failing closed on errors', async () => {
  for(const [email,profile,error,allowed] of [
    ['admin@example.invalid',{role:'admin',status:'active'},null,true],
    ['admin@example.invalid',{role:'pilot',status:'active'},null,false],
    ['admin@example.invalid',{role:'admin',status:'inactive'},null,false],
    ['other@example.invalid',{role:'admin',status:'active'},null,false],
    ['admin@example.invalid',null,{message:'unavailable'},false],
  ]) {
    const user={id:'test-user',email};const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:profile,error})};
    const accessModule=load('../lib/operations/console-auth.ts',{'server-only':{},'next/navigation':{redirect,notFound:()=>{throw new Error('404');}},'@/lib/auth/security':security,'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user}})},from:()=>query})}},{KVA_OPERATIONS_ADMIN_EMAILS:'admin@example.invalid'});
    assert.equal((await accessModule.getOperationsConsoleAccess()).allowed,allowed);
  }
});


test('unverified automatic recovery remains disabled and cannot send mail', async () => {
  let sent=false;
  const {requestPasswordReset}=actions('../app/pilots/forgot-password/actions.ts',{resetPasswordForEmail:async()=>{sent=true;return {error:null};}});
  await assert.rejects(requestPasswordReset(form({email:'pilot@example.invalid'})),e=>e.path==='/pilots/forgot-password?message=contact');
  assert.equal(sent,false);
});

test('ordinary logout revokes only the current session and reports provider failure', async () => {
  for (const [relative,name] of [['../components/actions.ts','signOutAction'],['../app/pilots/login/actions.ts','logout']]) {
    let scope;
    const auth={signOut:async options=>{scope=options.scope;return {error:null};}};
    await assert.rejects(actions(relative,auth)[name](),e=>e.path==='/');
    assert.equal(scope,'local');
    await assert.rejects(actions(relative,{signOut:async()=>({error:{status:503}})})[name](),e=>e.path==='/pilots/login?error=unavailable');
  }
});
