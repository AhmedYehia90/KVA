import type {Metadata} from "next";
import type {ReactNode} from "react";
import Link from "next/link";
import {requireOperationsConsoleAdmin} from "@/lib/operations/console-auth";
import {createAdminClient} from "@/lib/supabase/admin";
import {
  createGlobalEventAction,
  setGlobalEventLifecycleAction
} from "./actions";

export const metadata: Metadata = {
  title: "Global Events Operations | KVA OS"
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Airport = {
  icao_code:string;
};

type Fleet = {
  icao_code:string;
};

type Route = {
  id:string;
  flight_number:string;
  scheduled_minutes:number | null;
  departure:Airport | Airport[] | null;
  arrival:Airport | Airport[] | null;
  fleet_type:Fleet | Fleet[] | null;
};

type EventRow = {
  id:string;
  code:string;
  slug:string;
  title:string;
  category:string;
  lifecycle_status:string;
  starts_at:string;
  ends_at:string;
  registration_opens_at:string;
  registration_closes_at:string;
  required_flights:number;
  completion_badge_name:string;
  created_at:string;
};

function first<T>(value:T | T[] | null | undefined):T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function firstParam(value:string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(value:string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle:"medium",
    timeStyle:"short"
  }).format(new Date(value));
}

export default async function GlobalEventsOperationsPage({
  searchParams
}: {
  searchParams:SearchParams;
}) {
  await requireOperationsConsoleAdmin();
  const params = await searchParams;
  const message = firstParam(params.message);
  const errorMessage = firstParam(params.error);
  const admin = createAdminClient();

  const [eventsResult,routesResult] = await Promise.all([
    admin
      .from("global_aviation_events")
      .select(
        "id,code,slug,title,category,lifecycle_status,starts_at,ends_at,registration_opens_at,registration_closes_at,required_flights,completion_badge_name,created_at"
      )
      .order("starts_at", {ascending:false})
      .limit(100),
    admin
      .from("routes")
      .select(`
        id,
        flight_number,
        scheduled_minutes,
        departure:airports!routes_departure_airport_id_fkey(icao_code),
        arrival:airports!routes_arrival_airport_id_fkey(icao_code),
        fleet_type:fleet_types!routes_fleet_type_id_fkey(icao_code)
      `)
      .eq("active", true)
      .order("flight_number", {ascending:true})
  ]);

  const firstError = eventsResult.error ?? routesResult.error;

  if (firstError) {
    throw new Error(
      `Unable to load Global Events Operations: ${firstError.message}`
    );
  }

  const events = (eventsResult.data ?? []) as EventRow[];
  const routes = (routesResult.data ?? []) as unknown as Route[];

  return (
    <main style={{minHeight:"100vh",background:"var(--bg)"}}>
      <section style={{
        padding:"72px 20px 110px",
        background:
          "radial-gradient(circle at 78% 24%,rgba(0,174,239,.26),transparent 30%),linear-gradient(145deg,#06152d,#0b2344 58%,#124d79)"
      }}>
        <div style={{maxWidth:1180,margin:"0 auto"}}>
          <Link
            href="/operations"
            style={{color:"var(--accent)",fontWeight:850}}
          >
            ← Operations Center
          </Link>
          <p className="eyebrow" style={{marginTop:34}}>
            KVA OS · Global Network Control
          </p>
          <h1 style={{
            margin:"12px 0 18px",
            fontSize:"clamp(3.2rem,7vw,5.6rem)",
            lineHeight:.94,
            letterSpacing:"-.055em"
          }}>
            Global Aviation Events
          </h1>
          <p style={{
            maxWidth:820,
            margin:0,
            color:"var(--muted)",
            lineHeight:1.8
          }}>
            Publish shared aviation campaigns, select eligible missions and
            control the event lifecycle without changing any pilot flight
            records manually.
          </p>
        </div>
      </section>

      <section style={{padding:"0 20px 100px"}}>
        <div style={{
          maxWidth:1180,
          margin:"0 auto",
          display:"grid",
          gap:22,
          transform:"translateY(-42px)"
        }}>
          {message ? <Notice success>{message}</Notice> : null}
          {errorMessage ? <Notice>{errorMessage}</Notice> : null}

          <section style={panelStyle}>
            <p className="eyebrow">Publish Event</p>
            <h2 style={{margin:"8px 0 18px"}}>
              Create a Global Aviation Event
            </h2>

            <form action={createGlobalEventAction} style={{display:"grid",gap:16}}>
              <div style={twoColumnStyle}>
                <Field label="Event Code">
                  <input name="code" required placeholder="KVA-GLOBAL-002" style={inputStyle} />
                </Field>
                <Field label="Public Slug">
                  <input name="slug" required placeholder="mediterranean-relay" style={inputStyle} />
                </Field>
              </div>

              <div style={twoColumnStyle}>
                <Field label="Title">
                  <input name="title" required placeholder="Mediterranean Relay" style={inputStyle} />
                </Field>
                <Field label="Category">
                  <select name="category" defaultValue="global_campaign" style={inputStyle}>
                    <option value="global_campaign">Global Campaign</option>
                    <option value="network_challenge">Network Challenge</option>
                    <option value="anniversary">Anniversary</option>
                    <option value="special_operation">Special Operation</option>
                    <option value="community">Community</option>
                  </select>
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  name="description"
                  required
                  rows={4}
                  placeholder="Describe the event story, purpose and participation objective."
                  style={textareaStyle}
                />
              </Field>

              <div style={fourColumnStyle}>
                <Field label="Starts At · UTC">
                  <input name="startsAt" type="datetime-local" required style={inputStyle} />
                </Field>
                <Field label="Ends At · UTC">
                  <input name="endsAt" type="datetime-local" required style={inputStyle} />
                </Field>
                <Field label="Registration Opens · UTC">
                  <input name="registrationOpensAt" type="datetime-local" required style={inputStyle} />
                </Field>
                <Field label="Registration Closes · UTC">
                  <input name="registrationClosesAt" type="datetime-local" required style={inputStyle} />
                </Field>
              </div>

              <div style={twoColumnStyle}>
                <Field label="Required Flights">
                  <input
                    name="requiredFlights"
                    type="number"
                    min={1}
                    max={50}
                    defaultValue={1}
                    required
                    style={inputStyle}
                  />
                </Field>
                <Field label="Completion Badge">
                  <input
                    name="badgeName"
                    required
                    placeholder="Mediterranean Relay Finisher"
                    style={inputStyle}
                  />
                </Field>
              </div>

              <div>
                <p className="eyebrow">Eligible Missions</p>
                <div style={{
                  display:"grid",
                  gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",
                  gap:10,
                  marginTop:12
                }}>
                  {routes.map((route) => {
                    const departure = first(route.departure);
                    const arrival = first(route.arrival);
                    const fleet = first(route.fleet_type);

                    return (
                      <label key={route.id} style={routeChoiceStyle}>
                        <input type="checkbox" name="routeId" value={route.id} />
                        <span>
                          <strong>{route.flight_number}</strong>
                          <small style={{
                            display:"block",
                            marginTop:4,
                            color:"var(--muted)"
                          }}>
                            {departure?.icao_code ?? "—"} → {arrival?.icao_code ?? "—"}
                            {" · "}
                            {fleet?.icao_code ?? "—"}
                            {route.scheduled_minutes
                              ? ` · ${route.scheduled_minutes} min`
                              : ""}
                          </small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <button className="button" type="submit">
                  Publish global event
                </button>
              </div>
            </form>
          </section>

          <section style={{display:"grid",gap:15}}>
            <div>
              <p className="eyebrow">Event Control</p>
              <h2 style={{margin:"8px 0 0"}}>Published & Historical Events</h2>
            </div>

            {events.length ? events.map((event) => (
              <article key={event.id} style={panelStyle}>
                <div style={{
                  display:"flex",
                  justifyContent:"space-between",
                  gap:20,
                  alignItems:"flex-start",
                  flexWrap:"wrap"
                }}>
                  <div style={{maxWidth:750}}>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      <Badge value={event.lifecycle_status} />
                      <Badge value={event.category.replaceAll("_"," ")} />
                    </div>
                    <p className="eyebrow" style={{marginTop:15}}>
                      {event.code}
                    </p>
                    <h3 style={{margin:"7px 0 8px",fontSize:"1.6rem"}}>
                      {event.title}
                    </h3>
                    <p style={{margin:0,color:"var(--muted)"}}>
                      {formatDate(event.starts_at)} → {formatDate(event.ends_at)}
                      {" · "}
                      {event.required_flights} required flight
                      {event.required_flights === 1 ? "" : "s"}
                    </p>
                    <p style={{margin:"7px 0 0",color:"var(--muted)"}}>
                      Reward: {event.completion_badge_name}
                    </p>
                  </div>

                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {event.lifecycle_status !== "published" ? (
                      <LifecycleButton
                        eventId={event.id}
                        status="published"
                        labelText="Publish"
                      />
                    ) : null}
                    {event.lifecycle_status !== "archived" ? (
                      <LifecycleButton
                        eventId={event.id}
                        status="archived"
                        labelText="Archive"
                      />
                    ) : null}
                    {event.lifecycle_status !== "cancelled" ? (
                      <LifecycleButton
                        eventId={event.id}
                        status="cancelled"
                        labelText="Cancel"
                      />
                    ) : null}
                  </div>
                </div>

                <div style={{
                  display:"flex",
                  justifyContent:"space-between",
                  gap:12,
                  marginTop:14,
                  flexWrap:"wrap"
                }}>
                  <Link
                    href={`/pilot/events/${event.slug}`}
                    style={{color:"var(--accent)",fontWeight:850}}
                  >
                    Open pilot event →
                  </Link>
                  <small style={{color:"var(--muted)"}}>
                    Created {formatDate(event.created_at)}
                  </small>
                </div>
              </article>
            )) : (
              <div style={panelStyle}>No events have been published yet.</div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function LifecycleButton({
  eventId,
  status,
  labelText
}: {
  eventId:string;
  status:"published" | "archived" | "cancelled";
  labelText:string;
}) {
  return (
    <form action={setGlobalEventLifecycleAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="status" value={status} />
      <button className="button outline" type="submit">
        {labelText}
      </button>
    </form>
  );
}

function Field({
  label,
  children
}: {
  label:string;
  children:ReactNode;
}) {
  return (
    <label style={{display:"grid",gap:7}}>
      <span style={{fontWeight:850}}>{label}</span>
      {children}
    </label>
  );
}

function Badge({value}:{value:string}) {
  return (
    <span style={{
      padding:"6px 9px",
      borderRadius:999,
      background:"rgba(255,255,255,.075)",
      fontSize:".7rem",
      fontWeight:850,
      textTransform:"uppercase"
    }}>
      {value}
    </span>
  );
}

function Notice({
  children,
  success = false
}: {
  children:ReactNode;
  success?:boolean;
}) {
  return (
    <div style={{
      padding:15,
      borderRadius:13,
      color:success ? "#98efbf" : "#ffb1b1",
      background:success
        ? "rgba(57,220,138,.1)"
        : "rgba(255,95,95,.1)"
    }}>
      {children}
    </div>
  );
}

const panelStyle = {
  padding:22,
  border:"1px solid var(--border)",
  borderRadius:20,
  background:"var(--surface)"
} as const;

const inputStyle = {
  width:"100%",
  padding:"12px 13px",
  border:"1px solid var(--border)",
  borderRadius:11,
  color:"inherit",
  background:"rgba(4,16,32,.42)"
} as const;

const textareaStyle = {
  ...inputStyle,
  resize:"vertical"
} as const;

const twoColumnStyle = {
  display:"grid",
  gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",
  gap:14
} as const;

const fourColumnStyle = {
  display:"grid",
  gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
  gap:14
} as const;

const routeChoiceStyle = {
  display:"flex",
  gap:10,
  alignItems:"flex-start",
  padding:14,
  border:"1px solid rgba(105,183,231,.13)",
  borderRadius:12,
  background:"rgba(4,16,32,.28)",
  cursor:"pointer"
} as const;
