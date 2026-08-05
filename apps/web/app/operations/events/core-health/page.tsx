import Link from "next/link";
import {requireOperationsConsoleAdmin} from "@/lib/operations/console-auth";
import {getCoreHealthData} from "@/lib/operations/getCoreHealthData";
import {retryDueEventsAction, requeueDeadLetterAction} from "./actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function CoreHealthPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  await requireOperationsConsoleAdmin();
  const params = await searchParams;
  const message = first(params.message);
  const error = first(params.error);
  const data = await getCoreHealthData();
  const health = data.health as Record<string, string | number | null>;

  return (
    <main style={{minHeight:"100vh",padding:"72px 20px",background:"var(--bg)"}}>
      <section style={{maxWidth:1180,margin:"0 auto"}}>
        <Link href="/operations/events" style={{color:"var(--accent)",fontWeight:850}}>
          ← Event Operations Console
        </Link>

        <p className="eyebrow" style={{marginTop:34}}>KVA Core Completion</p>
        <h1 style={{fontSize:"clamp(3.4rem,8vw,6rem)",margin:"12px 0 18px"}}>
          Core Health
        </h1>
        <p style={{color:"var(--muted)",lineHeight:1.8}}>
          Event reliability, aircraft state synchronization and Auto PIREP.
        </p>

        {message ? <Notice value={message} success /> : null}
        {error ? <Notice value={error} /> : null}

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,marginTop:26}}>
          <Stat label="Health" value={String(health.health_status ?? "healthy")} />
          <Stat label="Events" value={String(health.total_events ?? 0)} />
          <Stat label="Processed" value={String(health.processed_events ?? 0)} />
          <Stat label="Failed" value={String(health.failed_events ?? 0)} />
          <Stat label="Dead letters" value={String(health.dead_letter_events ?? 0)} />
        </div>

        <Panel title="Dead Letter Queue">
          <form action={retryDueEventsAction} style={{display:"flex",gap:8,marginBottom:18}}>
            <input name="limit" type="number" min="1" max="500" defaultValue="100" />
            <button className="button" type="submit">Retry due events</button>
          </form>

          {data.deadLetters.length ? data.deadLetters.map((item) => (
            <article key={item.id} style={cardStyle}>
              <div>
                <strong>{item.consumer_name}</strong>
                <small style={{display:"block",marginTop:6,color:"var(--muted)"}}>
                  {item.event_id} · {item.attempts} attempts
                </small>
                <p style={{color:"#ffb1b1"}}>{item.last_error ?? "No error recorded."}</p>
              </div>
              <form action={requeueDeadLetterAction}>
                <input type="hidden" name="deadLetterId" value={item.id} />
                <button className="button" type="submit">Requeue</button>
              </form>
            </article>
          )) : <p style={{color:"var(--muted)"}}>No open dead-letter events.</p>}
        </Panel>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:18}}>
          <Panel title="Aircraft State">
            {data.aircraftStates.length ? data.aircraftStates.map((item) => (
              <article key={item.aircraft_id} style={cardStyle}>
                <strong>{item.operational_status}</strong>
                <small style={{color:"var(--muted)"}}>{item.last_event_type}</small>
              </article>
            )) : <p style={{color:"var(--muted)"}}>No aircraft state records yet.</p>}
          </Panel>

          <Panel title="Auto PIREP Drafts">
            {data.drafts.length ? data.drafts.map((item) => (
              <article key={item.id} style={cardStyle}>
                <div>
                  <strong>{item.flight_number}</strong>
                  <small style={{display:"block",marginTop:6,color:"var(--muted)"}}>
                    {item.suggested_block_minutes} min · {item.status}
                  </small>
                </div>
              </article>
            )) : <p style={{color:"var(--muted)"}}>No drafts yet.</p>}
          </Panel>
        </div>
      </section>
    </main>
  );
}

const cardStyle = {
  display:"flex",
  justifyContent:"space-between",
  alignItems:"center",
  gap:18,
  marginTop:12,
  padding:18,
  border:"1px solid var(--border)",
  borderRadius:14,
  background:"rgba(4,16,32,.32)"
} as const;

function Notice({value, success = false}: {value:string; success?:boolean}) {
  return (
    <div style={{
      marginTop:18,
      padding:15,
      borderRadius:12,
      color:success ? "#98efbf" : "#ffb1b1",
      background:success ? "rgba(57,220,138,.1)" : "rgba(255,95,95,.1)"
    }}>
      {value}
    </div>
  );
}

function Stat({label, value}: {label:string; value:string}) {
  return (
    <article style={{padding:20,border:"1px solid var(--border)",borderRadius:16,background:"var(--surface)"}}>
      <small style={{color:"var(--muted)",fontWeight:850}}>{label.toUpperCase()}</small>
      <strong style={{display:"block",marginTop:12,fontSize:"1.8rem",textTransform:"capitalize"}}>{value}</strong>
    </article>
  );
}

function Panel({title, children}: {title:string; children:React.ReactNode}) {
  return (
    <section style={{marginTop:22,padding:22,border:"1px solid var(--border)",borderRadius:18,background:"var(--surface)"}}>
      <h2 style={{marginTop:0}}>{title}</h2>
      {children}
    </section>
  );
}
