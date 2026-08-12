import type {Metadata} from "next";
import Link from "next/link";
import {requireOperationsConsoleAdmin} from "@/lib/operations/console-auth";
import {createAdminClient} from "@/lib/supabase/admin";
import {updatePolicyAction,createPilotItemAction,setPilotItemUnlockAction,createCompanyItemAction,purchaseCompanyItemAction,createRouteCampaignAction,reviewRouteCampaignAction} from "./actions";
import {MarketplaceThumbnail} from "@/components/marketplace/MarketplaceThumbnail";
import {getAircraftMarketplaceThumbnail,getMarketplaceThumbnailAlt,getPilotMarketplaceThumbnail} from "@/lib/marketplaceVisuals";

export const metadata:Metadata={title:"Operations Economy Console | KVA OS"};
export const dynamic="force-dynamic";
const ORG="kalabsha-airlines";
type SearchParams=Promise<Record<string,string|string[]|undefined>>;
function first(v:string|string[]|undefined){return Array.isArray(v)?v[0]??"":v??""}
function money(v:number){return new Intl.NumberFormat("en-US").format(v)+" KVC"}

export default async function EconomyOperationsPage({searchParams}:{searchParams:SearchParams}){
  await requireOperationsConsoleAdmin();const q=await searchParams;const admin=createAdminClient();
  const [accountR,policyR,pilotItemsR,companyItemsR,assetsR,campaignR,ledgerR,auditR,fleetR,airportR,ranksR,milestoneDefsR]=await Promise.all([
    admin.from("company_economy_accounts").select("*").eq("organization_id",ORG).single(),
    admin.from("economy_salary_policies").select("*").eq("organization_id",ORG).single(),
    admin.from("pilot_marketplace_items").select("*").order("created_at",{ascending:false}),
    admin.from("company_marketplace_items").select("*,fleet_type:fleet_types(icao_code)").order("created_at",{ascending:false}),
    admin.from("company_economy_assets").select("id,asset_kind,status,fleet_type_id,acquired_at,metadata").order("acquired_at",{ascending:false}),
    admin.from("route_support_campaigns").select("*,departure:airports!route_support_campaigns_departure_airport_id_fkey(icao_code),arrival:airports!route_support_campaigns_arrival_airport_id_fkey(icao_code)").eq("organization_id",ORG).order("created_at",{ascending:false}),
    admin.from("economy_ledger").select("*").eq("organization_id",ORG).order("created_at",{ascending:false}).limit(30),
    admin.from("economy_admin_audit").select("*").eq("organization_id",ORG).order("created_at",{ascending:false}).limit(20),
    admin.from("fleet_types").select("id,icao_code").order("icao_code"),
    admin.from("airports").select("id,icao_code,name").order("icao_code"),
    admin.from("ranks").select("code,name,priority").order("priority"),
    admin.from("career_milestone_definitions").select("code,title,threshold").eq("active",true).order("threshold")
  ]);
  const err=[accountR,policyR,pilotItemsR,companyItemsR,assetsR,campaignR,ledgerR,auditR,fleetR,airportR,ranksR,milestoneDefsR].find((r:any)=>r.error)?.error;if(err)throw new Error(`Unable to load Operations Economy Console: ${err.message}`);
  const a:any=accountR.data,p:any=policyR.data,pi:any[]=pilotItemsR.data??[],ci:any[]=companyItemsR.data??[],assets:any[]=assetsR.data??[],campaigns:any[]=campaignR.data??[],ledger:any[]=ledgerR.data??[],audits:any[]=auditR.data??[],fleet:any[]=fleetR.data??[],airports:any[]=airportR.data??[],ranks:any[]=ranksR.data??[],milestoneDefs:any[]=milestoneDefsR.data??[];
  return <main style={{minHeight:"100vh",background:"var(--bg)"}}>
    <section style={{padding:"74px 20px 110px",background:"radial-gradient(circle at 80% 20%,rgba(0,174,239,.25),transparent 30%),linear-gradient(145deg,#06152d,#0b2344 58%,#124d79)"}}><div style={{maxWidth:1180,margin:"0 auto"}}><Link href="/operations" style={{color:"var(--accent)",fontWeight:850}}>← Operations Center</Link><p className="eyebrow" style={{marginTop:32}}>KVA OS · Pillar 08 · Company Authority</p><h1 style={{fontSize:"clamp(3.2rem,7vw,5.7rem)",margin:"10px 0"}}>Operations Economy Console</h1><p style={{maxWidth:850,color:"var(--muted)",lineHeight:1.8}}>Pilot and company economies share one ledger, but authority stays separate. Aircraft purchase, lease, fleet management and route activation remain Operations-only decisions.</p></div></section>
    <section style={{padding:"0 20px 100px"}}><div style={{maxWidth:1180,margin:"0 auto",display:"grid",gap:22,transform:"translateY(-44px)"}}>
      {first(q.message)?<div style={ok}>{first(q.message)}</div>:null}{first(q.error)?<div style={bad}>{first(q.error)}</div>:null}
      <div style={stats}><Stat label="Company KVA Credits" value={money(a.balance)}/><Stat label="Income" value={money(a.total_income)}/><Stat label="Spent" value={money(a.total_spent)}/><Stat label="Active Campaigns" value={String(campaigns.filter(x=>["active","goal_reached","under_review"].includes(x.status)).length)}/></div>
      <section style={panel}><p className="eyebrow">Salary & Rewards</p><h2>Evidence-backed policy</h2><form action={updatePolicyAction} style={grid}><Field n="baseSalary" l="Base salary" v={p.base_salary}/><Field n="perBlockMinute" l="Per block minute" v={p.per_block_minute}/><Field n="performanceThreshold" l="Performance threshold" v={p.performance_threshold}/><Field n="performanceBonus" l="Performance bonus" v={p.performance_bonus}/><Field n="eventReward" l="Event reward" v={p.event_completion_reward}/><Field n="milestoneReward" l="Milestone reward" v={p.milestone_reward}/><button className="button" type="submit">Save policy</button></form></section>
      <section style={panel}><p className="eyebrow">Company Marketplace</p><h2>Company-only acquisitions</h2><p style={{color:"var(--muted)"}}>A purchase creates a company economic asset and ledger entry. It never creates or edits an aircraft registration automatically.</p><div style={marketGrid}>{ci.map(i=>{
  const fleetCode=i.fleet_type?.icao_code??null;
  const matchingAsset=assets.find((asset:any)=>
    asset.status==="acquired" &&
    String(asset.metadata?.marketplaceItemId??"")===String(i.id)
  );
  const oneTimeAcquired=i.item_kind==="aircraft_purchase"&&Boolean(matchingAsset);
  const canAfford=Number(a.balance)>=Number(i.price);
  const availability=oneTimeAcquired?"ACQUIRED":canAfford?"AVAILABLE FOR OPERATIONS":"INSUFFICIENT COMPANY BUDGET";
  return <article key={i.id} style={{...inner,display:"flex",flexDirection:"column"}}>
    <MarketplaceThumbnail
      src={fleetCode?getAircraftMarketplaceThumbnail(fleetCode):"/marketplace/placeholder.svg"}
      alt={getMarketplaceThumbnailAlt(i.name)}
      badge="Company Only"
    />
    <small style={{color:oneTimeAcquired?"#98efbf":"var(--accent)",fontWeight:850,letterSpacing:".06em",textTransform:"uppercase"}}>{availability}</small>
    <strong style={{fontSize:"1.08rem",marginTop:8}}>{i.name}</strong>
    <p style={{color:"var(--muted)",lineHeight:1.5,flexGrow:1}}>
      {i.item_kind} · {fleetCode??"No fleet type"}
    </p>
    <b>{money(i.price)}</b>
    {oneTimeAcquired
      ?<div style={{marginTop:10,color:"#98efbf",fontWeight:800}}>
          Acquired
          {matchingAsset?.acquired_at?<small style={{display:"block",color:"var(--muted)",fontWeight:500,marginTop:4}}>Economic asset recorded</small>:null}
        </div>
      :<form action={purchaseCompanyItemAction} style={{marginTop:10}}>
          <input type="hidden" name="itemId" value={i.id}/>
          <button className="button" type="submit" disabled={!canAfford} style={!canAfford?{opacity:.55,cursor:"not-allowed"}:undefined}>
            {canAfford?"Acquire asset":"Insufficient company KVC"}
          </button>
        </form>}
  </article>
})}</div><h3>Create Company item</h3><form action={createCompanyItemAction} style={grid}><Input n="code" p="COMPANY-ITEM-002"/><Input n="name" p="Item name"/><Input n="description" p="Description"/><select name="itemKind" style={input}><option value="aircraft_purchase">Aircraft Purchase</option><option value="aircraft_lease">Aircraft Lease</option><option value="operational_asset">Operational Asset</option><option value="expansion">Expansion</option><option value="service">Service</option></select><select name="fleetTypeId" style={input}><option value="">No fleet type</option>{fleet.map(f=><option key={f.id} value={f.id}>{f.icao_code}</option>)}</select><Input n="price" p="500000" type="number"/><button className="button" type="submit">Create company item</button></form></section>
      <section style={panel}><p className="eyebrow">Pilot Marketplace Administration</p><h2>Personal progression items</h2><div style={marketGrid}>{pi.map(i=>{
  const unlock=i.metadata?.visualMarketplace?.unlock??{};
  return <article key={i.id} style={{...inner,display:"flex",flexDirection:"column"}}>
    <MarketplaceThumbnail
      src={getPilotMarketplaceThumbnail(`${i.code??""} ${i.name??""}`)}
      alt={getMarketplaceThumbnailAlt(i.name)}
      badge={i.category??"Pilot Item"}
    />
    <small style={{color:"var(--accent)",fontWeight:850,letterSpacing:".06em",textTransform:"uppercase"}}>PILOT ONLY</small>
    <strong style={{fontSize:"1.08rem",marginTop:8}}>{i.name}</strong>
    <p style={{color:"var(--muted)"}}>{i.category}</p>
    <b>{money(i.price)}</b>
    <form action={setPilotItemUnlockAction} style={{display:"grid",gap:8,marginTop:14,paddingTop:14,borderTop:"1px solid rgba(105,183,231,.14)"}}>
      <input type="hidden" name="itemId" value={i.id}/>
      <small style={{fontWeight:800}}>UNLOCK REQUIREMENTS</small>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
        <label style={{fontSize:12}}>Career XP<input name="minimumCareerXp" type="number" min="0" defaultValue={unlock.minimumCareerXp??0} style={input}/></label>
        <label style={{fontSize:12}}>Flights<input name="minimumFlights" type="number" min="0" defaultValue={unlock.minimumFlights??0} style={input}/></label>
      </div>
      <select name="requiredRankCode" defaultValue={unlock.requiredRankCode??""} style={input}>
        <option value="">No rank requirement</option>
        {ranks.map(r=><option key={r.code} value={r.code}>{r.code} · {r.name}</option>)}
      </select>
      <select name="requiredMilestoneCode" defaultValue={unlock.requiredMilestoneCode??""} style={input}>
        <option value="">No milestone requirement</option>
        {milestoneDefs.map(m=><option key={m.code} value={m.code}>{m.title}</option>)}
      </select>
      <button className="button" type="submit">Save unlock rules</button>
    </form>
  </article>
})}</div><form action={createPilotItemAction} style={{...grid,marginTop:16}}><Input n="code" p="PILOT-ITEM-004"/><Input n="name" p="Item name"/><Input n="description" p="Description"/><select name="category" style={input}><option value="profile_cosmetic">Profile Cosmetic</option><option value="passport_frame">Passport Frame</option><option value="career_display">Career Display</option><option value="profile_theme">Profile Theme</option><option value="collectible">Collectible</option><option value="commemorative">Commemorative</option></select><Input n="price" p="500" type="number"/><label><input type="checkbox" name="repeatable"/> Repeatable</label><button className="button" type="submit">Create pilot item</button></form></section>
      <section style={panel}><p className="eyebrow">Route Support Campaigns</p><h2>Interest signal → Operations decision</h2><div style={{display:"grid",gap:12}}>{campaigns.map(c=><article key={c.id} style={inner}><strong>{c.departure?.icao_code} → {c.arrival?.icao_code} · {c.title}</strong><p>{money(c.funded_amount)} / {money(c.target_amount)} · {c.status}</p><form action={reviewRouteCampaignAction} style={{display:"flex",gap:8,flexWrap:"wrap"}}><input type="hidden" name="campaignId" value={c.id}/><select name="status" style={input}><option value="under_review">Under review</option><option value="approved">Approve interest</option><option value="rejected">Reject</option><option value="closed">Close</option></select><input name="note" placeholder="Operations note" style={input}/><button className="button" type="submit">Record decision</button></form></article>)}</div><h3>Create campaign</h3><form action={createRouteCampaignAction} style={grid}><Input n="code" p="ROUTE-INTEREST-002"/><Input n="title" p="Route interest title"/><Input n="description" p="Campaign description"/><select name="departureId" style={input}>{airports.map(x=><option key={x.id} value={x.id}>{x.icao_code} · {x.name}</option>)}</select><select name="arrivalId" style={input}>{airports.map(x=><option key={x.id} value={x.id}>{x.icao_code} · {x.name}</option>)}</select><Input n="targetAmount" p="3000" type="number"/><button className="button" type="submit">Create campaign</button></form></section>
      <section style={panel}><p className="eyebrow">Unified Economy Ledger</p><h2>Recent company-linked transactions</h2>{ledger.map(x=><article key={x.id} style={{...inner,display:"flex",justifyContent:"space-between",gap:12,marginTop:8}}><div><strong>{x.transaction_type}</strong><small style={{display:"block",color:"var(--muted)"}}>{x.description}</small></div><b>{x.amount>0?"+":""}{money(x.amount)}</b></article>)}</section>
      <section style={panel}><p className="eyebrow">Admin Audit</p><h2>Recent operations actions</h2>{audits.map(x=><article key={x.id} style={{...inner,marginTop:8}}><strong>{x.action}</strong><small style={{display:"block",color:"var(--muted)"}}>{x.target_type} · {x.target_id??"—"}</small></article>)}</section>
    </div></section>
  </main>
}
function Stat({label,value}:{label:string,value:string}){return <article style={{...panel,minHeight:110}}><small>{label.toUpperCase()}</small><strong style={{display:"block",fontSize:"1.8rem",marginTop:12}}>{value}</strong></article>}
function Field({n,l,v}:{n:string,l:string,v:number}){return <label>{l}<input name={n} type="number" min="0" defaultValue={v} style={input}/></label>}
function Input({n,p,type="text"}:{n:string,p:string,type?:string}){return <input name={n} required placeholder={p} type={type} style={input}/>}
const panel={padding:22,border:"1px solid var(--border)",borderRadius:20,background:"var(--surface)"} as const;
const inner={padding:15,border:"1px solid rgba(105,183,231,.14)",borderRadius:13,background:"rgba(4,16,32,.28)"} as const;
const stats={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12} as const;
const grid={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,alignItems:"end"} as const;
const marketGrid={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14,alignItems:"stretch"} as const;
const input={width:"100%",padding:"11px 12px",border:"1px solid var(--border)",borderRadius:10,background:"rgba(4,16,32,.42)",color:"inherit"} as const;
const ok={padding:14,borderRadius:12,color:"#98efbf",background:"rgba(57,220,138,.1)"} as const;const bad={padding:14,borderRadius:12,color:"#ffb1b1",background:"rgba(255,95,95,.1)"} as const;
