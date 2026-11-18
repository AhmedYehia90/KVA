// Isolated PostgreSQL integration test. Never connects to a hosted database.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
if (!process.env.KVA_PRIVACY_PGLITE_MODULE) throw new Error('Supply a local PGlite module URL');
const {PGlite} = await import(process.env.KVA_PRIVACY_PGLITE_MODULE);
const db = new PGlite();
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon,authenticated;
create table public.pilot_passports (
 pilot_id uuid primary key, passport_number text unique not null, public_slug text unique not null,
 visibility text not null check(visibility in ('private','network','public')),
 status text not null check(status in ('active','suspended','retired')), bio text,
 issued_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table pilot_passports enable row level security;
create policy pilot_passports_select_own on pilot_passports for select to authenticated using(pilot_id=auth.uid());
create policy pilot_passports_update_own on pilot_passports for update to authenticated using(pilot_id=auth.uid()) with check(pilot_id=auth.uid());
grant all on pilot_passports to anon,authenticated,service_role;
-- Explicit legacy column grants must be revoked too.
grant update(status),select(passport_number) on pilot_passports to public;
insert into pilot_passports(pilot_id,passport_number,public_slug,visibility,status,bio) values
('${owner}','UPP-ONE','one','private','active','Owner'),
('${other}','UPP-TWO','two','network','active','Other');
create function public.test_issue_passport(p_id uuid) returns void language sql security definer set search_path='' as $$
 insert into public.pilot_passports(pilot_id,passport_number,public_slug,visibility,status)
 values(p_id,'UPP-THREE','three','private','active') $$;
`);
async function role(name,uid='') {
 await db.exec('reset role');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
 await db.exec(`set role ${name}`);
}
async function denied(sql,args=[]) {
 await assert.rejects(db.query(sql,args),e=>e.code==='42501');
}
const snapshot = (await db.query('select * from pilot_passports order by pilot_id')).rows;
await role('authenticated',owner);
await db.exec('begin');
await db.exec("update pilot_passports set status='retired',passport_number='FORGED' where pilot_id=auth.uid()");
await db.exec('rollback');
await role('anon');
await db.exec('begin;truncate pilot_passports;rollback;');
console.log('PASS BEFORE: reproduce owner administrative-field mutation and anonymous TRUNCATE in rolled-back transactions');
await db.exec('reset role');
const migration = readFileSync(fileURLToPath(new URL('../../../supabase/migrations/20261110120000_passport_column_privileges.sql',import.meta.url)),'utf8');
const rollout = readFileSync(fileURLToPath(new URL('../../../supabase/review/20261110_passport_safe_apply.sql',import.meta.url)),'utf8');
await db.exec(rollout); await db.exec(migration); await db.exec(rollout);
assert.deepEqual((await db.query('select * from pilot_passports order by pilot_id')).rows,snapshot);
console.log('PASS migration is repeatable and preserves every existing field and row');
for (const name of ['anon','authenticated']) {
 await role(name,name==='authenticated'?owner:'');
 await denied('truncate pilot_passports');
 await denied('delete from pilot_passports');
 await denied("insert into pilot_passports(pilot_id,passport_number,public_slug,visibility,status) values(gen_random_uuid(),'X','x','private','active')");
 for(const [column,value] of [['pilot_id',other],['passport_number','FORGED'],['public_slug','forged'],['status','retired'],['issued_at','2000-01-01']]) {
  await denied(`update pilot_passports set ${column}=$1 where pilot_id=$2`,[value,owner]);
 }
 assert.equal((await db.query("select has_table_privilege(current_user,'public.pilot_passports','TRIGGER') as allowed")).rows[0].allowed,false);
 if(name==='anon') {
  await denied('select * from pilot_passports');
  await denied("update pilot_passports set bio='denied'");
 }
}
console.log('PASS AFTER: visitors denied; users cannot forge identity/issuance, insert, delete, truncate or create triggers');
await role('authenticated',owner);
assert.equal((await db.query('select * from pilot_passports')).rows.length,1);
const result=await db.query("update pilot_passports set bio='Edited',visibility='public' where pilot_id=$1 returning *",[owner]);
assert.equal(result.rows[0].bio,'Edited');assert.equal(result.rows[0].visibility,'public');
assert.ok(new Date(result.rows[0].updated_at).getTime() > new Date(snapshot[0].updated_at).getTime());
assert.equal(new Date(result.rows[0].issued_at).getTime(),new Date(snapshot[0].issued_at).getTime());
assert.equal(result.rows[0].status,'active');
const compatible=await db.query("update pilot_passports set visibility='private',updated_at='2000-01-01' where pilot_id=$1 returning updated_at",[owner]);
assert.ok(new Date(compatible.rows[0].updated_at).getTime()>=new Date(snapshot[0].updated_at).getTime());
assert.notEqual(new Date(compatible.rows[0].updated_at).getTime(),new Date('2000-01-01').getTime());
assert.equal((await db.query("update pilot_passports set visibility='public' where pilot_id=$1 returning pilot_id",[other])).rows.length,0);
await db.exec('reset role;create policy unsafe_legacy_read on pilot_passports for select using(true);create policy unsafe_legacy_update on pilot_passports for update using(true) with check(true);');
await role('authenticated',owner);
assert.equal((await db.query('select * from pilot_passports')).rows.length,1);
assert.equal((await db.query("update pilot_passports set bio='denied' where pilot_id=$1 returning pilot_id",[other])).rows.length,0);
console.log('PASS owner bio/visibility work with server timestamp; cross-user access denied even with broad legacy policies');
await role('service_role');
await db.exec("update pilot_passports set status='suspended' where public_slug='two'");
assert.equal((await db.query("select status from pilot_passports where public_slug='two'")).rows[0].status,'suspended');
assert.equal((await db.query("select has_table_privilege(current_user,'pilot_passports','TRUNCATE') as allowed")).rows[0].allowed,true);
await db.exec('reset role');
await db.query('select public.test_issue_passport($1)',['33333333-3333-4333-8333-333333333333']);
assert.equal((await db.query('select count(*)::int as count from pilot_passports')).rows[0].count,3);
console.log('PASS authorized service access and SECURITY DEFINER issuance retained');
await db.close();
