// Optional isolated integration check. See docs/11-release/PILOT_PRIVACY_REVIEW.md.
// The supplied module is a local PGlite install; no hosted database is contacted.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

if (!process.env.KVA_PRIVACY_PGLITE_MODULE) throw new Error('Set KVA_PRIVACY_PGLITE_MODULE to the local PGlite module URL; never a database URL');
const {PGlite} = await import(process.env.KVA_PRIVACY_PGLITE_MODULE);
const db = new PGlite();
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const staff = '33333333-3333-4333-8333-333333333333';
await db.exec(`
create role anon; create role authenticated; create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
create table profiles(id uuid primary key, pilot_number bigint, callsign text, full_name text, email text, country_code text, avatar_url text, role text, status text, total_hours numeric, total_flights integer);
create function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role in ('dispatcher','staff','admin') and status='active') $$;
alter table profiles enable row level security;
create policy "Read own profile or staff" on profiles for select using(auth.uid()=id or is_staff());
create policy "Update own profile or staff" on profiles for update using(auth.uid()=id or is_staff()) with check(auth.uid()=id or is_staff());
-- Deliberately simulate unsafe extra legacy grants and policies.
create policy legacy_open_read on profiles for select using(true);
create policy legacy_open_update on profiles for update using(true) with check(true);
grant all on profiles to anon,authenticated;
grant select(email),update(role) on profiles to anon,authenticated;
create table ranks(code text,name text,minimum_hours numeric,minimum_flights integer,priority integer);
create table pilot_passports(pilot_id uuid,passport_number text,public_slug text,issued_at timestamptz default now(),visibility text,status text);
create table platform_organizations(id text,code text,name text);
create table pilot_airline_memberships(pilot_id uuid,organization_id text,role text,status text,joined_at timestamptz,is_primary boolean);
create table fleet_types(id uuid,icao_code text);
create table pilot_qualifications(pilot_id uuid,qualification_code text,qualification_name text,status text,issued_at timestamptz,expires_at timestamptz,fleet_type_id uuid);
create table pilot_experience_ledger(pilot_id uuid,block_minutes integer,pirep_status text);
insert into profiles values
('${owner}',1,'TEST001','Private Owner','owner@example.invalid','EG',null,'pilot','active',12,2),
('${other}',2,'TEST002','Private Other','other@example.invalid','EG',null,'pilot','active',5,1),
('${staff}',3,'TEST003','Private Staff','staff@example.invalid','EG',null,'admin','active',20,3);
insert into ranks values('CADET','Cadet',0,0,1);
insert into pilot_passports(pilot_id,passport_number,public_slug,visibility,status) values
('${owner}','UPP-ONE','public-test','public','active'),
('${other}','UPP-TWO','private-test','private','active'),
('${staff}','UPP-THREE','inactive-test','public','inactive');
`);
const migration = readFileSync(resolve(root, 'supabase/migrations/20261109120000_pilot_data_privacy.sql'), 'utf8');
await db.exec(migration);
await db.exec(migration); // Repeatability must not rewrite profile data or broaden permissions.
console.log('PASS migration applies twice on isolated PostgreSQL');

await db.exec("set role anon; select set_config('request.jwt.claim.sub','',false);");
await assert.rejects(db.query('select email,full_name from profiles'), error => error.code === '42501');
console.log('PASS anonymous profile reads denied, including legacy column grants');
const publicPassport = (await db.query("select get_public_pilot_passport('public-test') as passport")).rows[0].passport;
assert.equal(publicPassport.callsign, 'TEST001');
for (const privateField of ['fullName','email','Private Owner','owner@example.invalid',owner]) assert.ok(!JSON.stringify(publicPassport).includes(privateField));
for (const slug of ['private-test','inactive-test','missing-test']) assert.equal((await db.query('select get_public_pilot_passport($1) as passport',[slug])).rows[0].passport,null);
console.log('PASS anonymous public RPC omits PII; private/inactive/missing passports return null');

await db.exec(`reset role; select set_config('request.jwt.claim.sub','${owner}',false);set role authenticated;`);
const rows = (await db.query('select id,email,full_name from profiles')).rows;
assert.equal(rows.length,1);assert.equal(rows[0].id,owner);
assert.equal((await db.query('select id from profiles where id=$1',[other])).rows.length,0);
await db.query("update profiles set full_name='Owner correction' where id=$1",[owner]);
for (const [column,value] of [['role','admin'],['status','active'],['total_hours',9999],['total_flights',9999],['email','changed@example.invalid']]) {
  await assert.rejects(db.query(`update profiles set ${column}=$1 where id=$2`,[value,owner]),error => error.code === '42501');
}
assert.equal((await db.query("update profiles set full_name='Unauthorised' where id=$1 returning id",[other])).rows.length,0);
await assert.rejects(db.query('delete from profiles where id=$1',[owner]),error => error.code === '42501');
console.log('PASS owner sees/edits only own allowed fields; no role/status/totals escalation or cross-user mutation');

await db.exec(`reset role; select set_config('request.jwt.claim.sub','${staff}',false);set role authenticated;`);
assert.equal((await db.query('select id from profiles')).rows.length,3);
await assert.rejects(db.query("update profiles set role='admin' where id=$1",[other]),error => error.code === '42501');
console.log('PASS active staff read access retained without granting direct role editing');
await db.exec(`reset role; update profiles set status='inactive' where id='${staff}'; set role authenticated;`);
assert.equal((await db.query('select id from profiles')).rows.length,1);
assert.equal((await db.query('select id from profiles where id=$1',[other])).rows.length,0);
console.log('PASS inactive staff cannot read other pilots');
await db.exec('reset role;');
assert.equal((await db.query('select count(*)::int as count from profiles')).rows[0].count,3);
assert.equal((await db.query('select visibility from pilot_passports where pilot_id=$1',[other])).rows[0].visibility,'private');
console.log('PASS no records deleted and passport visibility preserved');

await db.exec(`
create table flight_bookings(id uuid primary key,pilot_id uuid);
create table flights(id uuid primary key,pilot_id uuid);
create table pireps(id uuid primary key,pilot_id uuid);
grant select,insert,update on flight_bookings,flights,pireps to authenticated;
grant insert on flight_bookings,flights,pireps to anon;
create function public.test_definer_booking() returns void language plpgsql security definer set search_path=public as $$ begin insert into flight_bookings values(gen_random_uuid(),auth.uid());end; $$;
grant execute on function public.test_definer_booking() to authenticated;
`);
const activeMigration=readFileSync(resolve(root,'supabase/migrations/20261109130000_active_pilot_operations.sql'),'utf8');
await db.exec(activeMigration);await db.exec(activeMigration);
await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false);set role authenticated;`);
await db.query('select public.test_definer_booking()');
assert.equal((await db.query('select id from flight_bookings')).rows.length,1);
await db.exec(`reset role;update profiles set status='pending' where id='${owner}';set role authenticated;`);
await assert.rejects(db.query('select public.test_definer_booking()'),error=>error.code==='42501');
for(const table of ['flight_bookings','flights','pireps']) await assert.rejects(db.query(`insert into ${table} values(gen_random_uuid(),$1)`,[owner]),error=>error.code==='42501');
await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role anon;");
await assert.rejects(db.query('insert into flight_bookings values(gen_random_uuid(),$1)',[owner]),error=>error.code==='42501');
await db.exec('reset role;');
await db.query('insert into flight_bookings values(gen_random_uuid(),$1)',[owner]);
assert.equal((await db.query('select id from flight_bookings')).rows.length,2);
console.log('PASS active-pilot triggers protect direct writes and SECURITY DEFINER RPCs; trusted background writes preserved');
await db.close();
