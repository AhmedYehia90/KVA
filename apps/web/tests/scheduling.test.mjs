import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const directory=dirname(fileURLToPath(import.meta.url));
function load(relative,imports={},env={}) {
 const source=ts.transpileModule(readFileSync(join(directory,relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};runInNewContext(source,{exports,Intl,Date,process:{env},require:name=>{
  if(!(name in imports))throw new Error('Unexpected import '+name);return imports[name];
 }});return exports;
}
const format=load('../lib/scheduling/format.ts');
const id='00000000-0000-0000-0000-000000000001';
const redirect=path=>{throw Object.assign(new Error('redirect'),{path});};
const notFound=()=>{throw Object.assign(new Error('notFound'),{status:404});};
function actions(client,env={KVA_SCHEDULING_PHASE1_ENABLED:'true'}) {
 const mode=load('../lib/scheduling/mode.ts',{'@/lib/supabase/server':{createClient:async()=>client}},env);
 return load('../app/pilot/schedule/actions.ts',{
  'next/navigation':{redirect,notFound},'next/cache':{revalidatePath:()=>{}},
  '@/lib/supabase/server':{createClient:async()=>client},'@/lib/scheduling/format':format,
  '@/lib/scheduling/mode':mode
 },env);
}
function form(key,value) {const f=new FormData();f.set(key,value);return f;}
test('scheduling is disabled by default and rejects malformed ids before accessing a database',async()=>{
 for(const env of [{},{KVA_SCHEDULING_PHASE1_ENABLED:'false'}])await assert.rejects(actions(null,env).bookScheduledFlight(form('scheduleId',id)),e=>e.status===404);
 await assert.rejects(actions(null).bookScheduledFlight(form('scheduleId','bad')),e=>e.path==='/pilot/schedule?error=invalid');
 for(const value of ['',null,{},'../secret',id+'x'])assert.equal(format.validScheduleId(value),false);
 assert.equal(format.validScheduleId(id),true);
});
test('booking requires authenticated user and calls only the scheduled RPC',async()=>{
 await assert.rejects(actions({auth:{getUser:async()=>({data:{user:null}})}}).bookScheduledFlight(form('scheduleId',id)),e=>e.path==='/pilots/login');
 const calls=[];const client={auth:{getUser:async()=>({data:{user:{id}}})},rpc:async(...args)=>{if(args[0]==='scheduling_mode_enabled')return {data:true,error:null};calls.push(args);return {error:null};}};
 await assert.rejects(actions(client).bookScheduledFlight(form('scheduleId',id)),e=>e.path==='/pilot/schedule?message=booked');
 assert.equal(calls.length,1);assert.equal(calls[0][0],'book_scheduled_flight');assert.equal(calls[0][1].p_schedule,id);
});
test('cancellation uses own-booking RPC; provider failures expose no raw database details',async()=>{
 let call;const client={auth:{getUser:async()=>({data:{user:{id}}})},rpc:async(...args)=>{if(args[0]==='scheduling_mode_enabled')return {data:true,error:null};call=args;return {error:null};}};
 await assert.rejects(actions(client).cancelScheduledBooking(form('bookingId',id)),e=>e.path==='/pilot/schedule?message=cancelled');
 assert.equal(call[0],'cancel_scheduled_booking');assert.equal(call[1].p_booking,id);
 client.rpc=async name=>name==='scheduling_mode_enabled'?{data:true,error:null}:{error:{message:'private SQL state'}};
 await assert.rejects(actions(client).bookScheduledFlight(form('scheduleId',id)),e=>e.path==='/pilot/schedule?error=unavailable');
});
test('application flag alone cannot enable scheduling; absent/error/false database mode fails closed',async()=>{
 const env={KVA_SCHEDULING_PHASE1_ENABLED:'true'};
 for(const result of [{data:false,error:null},{data:null,error:null},{data:true,error:{message:'RPC unavailable'}}]) {
  let mutations=0;const client={auth:{getUser:async()=>({data:{user:{id}}})},rpc:async name=>{assert.equal(name,'scheduling_mode_enabled');mutations++;return result;}};
  await assert.rejects(actions(client,env).bookScheduledFlight(form('scheduleId',id)),e=>e.status===404);
  assert.equal(mutations,1);
 }
});
test('mode probe requires both flags and treats transport errors as disabled without querying when application flag is off',async()=>{
 const disabled=load('../lib/scheduling/mode.ts',{'@/lib/supabase/server':{createClient:async()=>{throw new Error('Must not connect');}}},{});
 assert.equal(await disabled.scheduledBookingEnabled(),false);
 const active=load('../lib/scheduling/mode.ts',{'@/lib/supabase/server':{}},{KVA_SCHEDULING_PHASE1_ENABLED:'true'});
 assert.equal(await active.scheduledBookingEnabled({rpc:async()=>{throw new Error('offline');}}),false);
 assert.equal(await active.scheduledBookingEnabled({rpc:async()=>({data:true,error:null})}),true);
});
test('schedule times honor Cairo daylight saving and midnight with Arabic and English formatting',()=>{
 const winter=format.formatScheduledTime('2026-01-15T22:30:00Z','en','Africa/Cairo');
 const summer=format.formatScheduledTime('2026-07-15T22:30:00Z','en','Africa/Cairo');
 assert.match(winter,/16 Jan 2026, 00:30/);assert.match(summer,/16 Jul 2026, 01:30/);
 const ar=format.formatScheduledTime('2026-07-15T22:30:00Z','ar','Africa/Cairo');assert.match(ar,/[٠-٩]/);assert.match(ar,/١:٣٠/);
 assert.throws(()=>format.formatScheduledTime('2026-01-15','en','Fake/Zone'));
});
