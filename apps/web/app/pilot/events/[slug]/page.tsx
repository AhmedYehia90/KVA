import type {Metadata} from "next";
import type {ReactNode} from "react";
import Link from "next/link";
import {notFound, redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {
  joinGlobalEventAction,
  withdrawGlobalEventAction
} from "../actions";

export const metadata: Metadata = {
  title: "Global Aviation Event | KVA OS"
};

export const dynamic = "force-dynamic";

type Params = Promise<{slug:string}>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type EventRoute = {
  eventRouteId:string;
  routeId:string;
  sequence:number;
  missionLabel:string | null;
  points:number;
  flightNumber:string;
  scheduledMinutes:number | null;
  distanceNm:number | null;
  departure:string;
  departureName:string;
  arrival:string;
  arrivalName:string;
  aircraftType:string | null;
};

type CreditedFlight = {
  id:string;
  flightNumber:string;
  points:number;
  creditedAt:string;
};

type Participation = {
  id:string;
  status:"joined" | "completed" | "withdrawn";
  organizationId:string;
  completedFlights:number;
  targetFlights:number;
  points:number;
  joinedAt:string;
  completedAt:string | null;
  creditedFlights:CreditedFlight[];
};

type Achievement = {
  id:string;
  badgeCode:string;
  badgeName:string;
  awardedAt:string;
};

type EventDetail = {
  id:string;
  code:string;
  slug:string;
  title:string;
  description:string;
  category:string;
  lifecycleStatus:string;
  phase:"upcoming" | "live" | "completed" | "cancelled";
  registrationOpen:boolean;
  startsAt:string;
  endsAt:string;
  registrationOpensAt:string;
  registrationClosesAt:string;
  requiredFlights:number;
  badgeCode:string;
  badgeName:string;
  participants:number;
  completedParticipants:number;
  creditedFlights:number;
  organizations:Array<{
    id:string;
    code:string;
    name:string;
    role:string;
  }>;
  routes:EventRoute[];
  myParticipation:Participation | null;
  myAchievements:Achievement[];
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(value:string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle:"medium",
    timeStyle:"short"
  }).format(new Date(value));
}

function formatDuration(minutes:number | null) {
  if (!minutes) return "—";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}:${remainder.toString().padStart(2,"0")}`;
}

export default async function GlobalEventDetailPage({
  params,
  searchParams
}: {
  params:Params;
  searchParams:SearchParams;
}) {
  const {slug} = await params;
  const query = await searchParams;
  const message = first(query.message);
  const errorMessage = first(query.error);
  const supabase = await createClient();

  const {
    data:{user}
  } = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  const {data,error} = await supabase.rpc(
    "get_global_aviation_event_detail",
    {p_slug:slug}
  );

  if (error) {
    throw new Error(
      `Unable to load global aviation event: ${error.message}`
    );
  }

  if (!data) notFound();

  const event = data as unknown as EventDetail;
  const participation = event.myParticipation;
  const percent =
    participation && participation.targetFlights > 0
      ? Math.min(
          100,
          Math.round(
            participation.completedFlights /
              participation.targetFlights *
              100
          )
        )
      : 0;

  return (
    <main style={{minHeight:"100vh",background:"var(--bg)"}}>
      <section style={{
        padding:"72px 20px 116px",
        background:
          "radial-gradient(circle at 78% 24%,rgba(0,174,239,.28),transparent 30%),linear-gradient(145deg,#06152d,#0b2344 58%,#124d79)"
      }}>
        <div style={{maxWidth:1180,margin:"0 auto"}}>
          <Link
            href="/pilot/events"
            style={{color:"var(--accent)",fontWeight:850}}
          >
            ← Global Aviation Events
          </Link>

          <div style={{marginTop:34,display:"flex",gap:8,flexWrap:"wrap"}}>
            <Badge value={event.phase} />
            <Badge value={event.category.replaceAll("_"," ")} />
            {participation ? <Badge value={participation.status} /> : null}
          </div>

          <p className="eyebrow" style={{marginTop:22}}>
            {event.code}
          </p>
          <h1 style={{
            margin:"10px 0 18px",
            fontSize:"clamp(3rem,7vw,5.7rem)",
            lineHeight:.94,
            letterSpacing:"-.055em"
          }}>
            {event.title}
          </h1>
          <p style={{
            maxWidth:850,
            margin:0,
            color:"var(--muted)",
            lineHeight:1.8
          }}>
            {event.description}
          </p>
        </div>
      </section>

      <section style={{padding:"0 20px 100px"}}>
        <div style={{
          maxWidth:1180,
          margin:"0 auto",
          display:"grid",
          gap:22,
          transform:"translateY(-44px)"
        }}>
          {message ? <Notice success>{message}</Notice> : null}
          {errorMessage ? <Notice>{errorMessage}</Notice> : null}

          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",
            gap:12
          }}>
            <Stat label="Participants" value={String(event.participants)} />
            <Stat label="Completed" value={String(event.completedParticipants)} />
            <Stat label="Event Flights" value={String(event.creditedFlights)} />
            <Stat label="Missions" value={String(event.routes.length)} />
            <Stat label="Required" value={`${event.requiredFlights} flight${event.requiredFlights === 1 ? "" : "s"}`} />
          </div>

          <section style={panelStyle}>
            <div style={{
              display:"flex",
              justifyContent:"space-between",
              gap:18,
              alignItems:"flex-start",
              flexWrap:"wrap"
            }}>
              <div>
                <p className="eyebrow">Event Window</p>
                <h2 style={{margin:"8px 0 6px"}}>
                  {formatDate(event.startsAt)} → {formatDate(event.endsAt)}
                </h2>
                <p style={{margin:0,color:"var(--muted)"}}>
                  Registration closes {formatDate(event.registrationClosesAt)}
                </p>
              </div>

              {!participation || participation.status === "withdrawn" ? (
                event.registrationOpen ? (
                  <form action={joinGlobalEventAction}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="slug" value={event.slug} />
                    <button className="button" type="submit">
                      Join event
                    </button>
                  </form>
                ) : (
                  <span style={{color:"var(--muted)"}}>
                    Registration closed
                  </span>
                )
              ) : participation.status === "joined" ? (
                <form action={withdrawGlobalEventAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="slug" value={event.slug} />
                  <button className="button outline" type="submit">
                    Withdraw
                  </button>
                </form>
              ) : (
                <span style={{color:"#98efbf",fontWeight:850}}>
                  Event completed
                </span>
              )}
            </div>
          </section>

          {participation && participation.status !== "withdrawn" ? (
            <section style={panelStyle}>
              <p className="eyebrow">Your Participation</p>
              <div style={{
                display:"flex",
                justifyContent:"space-between",
                gap:16,
                alignItems:"flex-end",
                flexWrap:"wrap",
                marginTop:9
              }}>
                <div>
                  <h2 style={{margin:0}}>
                    {participation.completedFlights}/{participation.targetFlights}
                    {" "}eligible flights
                  </h2>
                  <p style={{
                    margin:"7px 0 0",
                    color:"var(--muted)"
                  }}>
                    {participation.points} event points
                  </p>
                </div>
                <strong style={{fontSize:"2rem"}}>{percent}%</strong>
              </div>

              <div style={{
                height:12,
                marginTop:16,
                borderRadius:999,
                overflow:"hidden",
                background:"rgba(255,255,255,.08)"
              }}>
                <span style={{
                  display:"block",
                  height:"100%",
                  width:`${percent}%`,
                  background:"var(--accent)"
                }} />
              </div>

              {event.myAchievements.length ? (
                <div style={{
                  marginTop:18,
                  display:"grid",
                  gap:10
                }}>
                  {event.myAchievements.map((achievement) => (
                    <article key={achievement.id} style={achievementStyle}>
                      <span>🏅</span>
                      <div>
                        <strong>{achievement.badgeName}</strong>
                        <small style={{
                          display:"block",
                          marginTop:4,
                          color:"var(--muted)"
                        }}>
                          {achievement.badgeCode} · {formatDate(achievement.awardedAt)}
                        </small>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p style={{
                  margin:"16px 0 0",
                  color:"var(--muted)"
                }}>
                  Completion reward: {event.badgeName}
                </p>
              )}
            </section>
          ) : null}

          <section style={panelStyle}>
            <p className="eyebrow">Event Missions</p>
            <h2 style={{margin:"8px 0 0"}}>Eligible Routes</h2>

            <div style={{display:"grid",gap:11,marginTop:18}}>
              {event.routes.map((route) => (
                <article key={route.eventRouteId} style={routeStyle}>
                  <div style={{minWidth:170}}>
                    <small style={{
                      color:"var(--accent)",
                      fontWeight:850
                    }}>
                      {route.missionLabel ?? `Mission ${route.sequence}`}
                    </small>
                    <h3 style={{margin:"7px 0 0"}}>
                      {route.flightNumber}
                    </h3>
                  </div>

                  <div style={{flex:1,minWidth:250}}>
                    <strong>
                      {route.departure} → {route.arrival}
                    </strong>
                    <small style={{
                      display:"block",
                      marginTop:5,
                      color:"var(--muted)"
                    }}>
                      {route.departureName} → {route.arrivalName}
                    </small>
                  </div>

                  <div>
                    <strong>{route.aircraftType ?? "—"}</strong>
                    <small style={{
                      display:"block",
                      marginTop:5,
                      color:"var(--muted)"
                    }}>
                      {formatDuration(route.scheduledMinutes)}
                      {route.distanceNm
                        ? ` · ${route.distanceNm.toLocaleString("en-US")} NM`
                        : ""}
                    </small>
                  </div>

                  <div style={{textAlign:"right"}}>
                    <strong>{route.points} pts</strong>
                    <Link
                      href={`/pilot/flights/${route.routeId}`}
                      style={{
                        display:"block",
                        marginTop:7,
                        color:"var(--accent)",
                        fontWeight:850
                      }}
                    >
                      Open flight →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {participation?.creditedFlights.length ? (
            <section style={panelStyle}>
              <p className="eyebrow">Your Event Record</p>
              <h2 style={{margin:"8px 0 0"}}>Credited Flights</h2>
              <div style={{display:"grid",gap:10,marginTop:17}}>
                {participation.creditedFlights.map((flight) => (
                  <article key={flight.id} style={creditedStyle}>
                    <strong>{flight.flightNumber}</strong>
                    <span>{flight.points} pts</span>
                    <span style={{color:"var(--muted)"}}>
                      {formatDate(flight.creditedAt)}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section style={panelStyle}>
            <p className="eyebrow">Cross-Airline Network</p>
            <h2 style={{margin:"8px 0 12px"}}>Organizations</h2>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              {event.organizations.map((organization) => (
                <span key={organization.id} style={organizationStyle}>
                  <strong>{organization.code}</strong>
                  {" · "}
                  {organization.name}
                  {" · "}
                  {organization.role}
                </span>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Badge({value}:{value:string}) {
  return (
    <span style={{
      padding:"6px 9px",
      borderRadius:999,
      background:"rgba(255,255,255,.075)",
      color:"var(--text)",
      fontSize:".7rem",
      fontWeight:850,
      textTransform:"uppercase"
    }}>
      {value}
    </span>
  );
}

function Stat({label,value}:{label:string;value:string}) {
  return (
    <article style={{
      minHeight:115,
      padding:20,
      border:"1px solid var(--border)",
      borderRadius:17,
      background:"var(--surface)"
    }}>
      <small style={{color:"var(--muted)",fontWeight:850}}>
        {label.toUpperCase()}
      </small>
      <strong style={{
        display:"block",
        marginTop:14,
        fontSize:"1.8rem"
      }}>
        {value}
      </strong>
    </article>
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

const routeStyle = {
  display:"flex",
  gap:18,
  alignItems:"center",
  justifyContent:"space-between",
  flexWrap:"wrap",
  padding:17,
  border:"1px solid rgba(105,183,231,.13)",
  borderRadius:14,
  background:"rgba(4,16,32,.28)"
} as const;

const achievementStyle = {
  display:"flex",
  gap:12,
  alignItems:"center",
  padding:14,
  border:"1px solid rgba(57,220,138,.24)",
  borderRadius:13,
  background:"rgba(57,220,138,.08)"
} as const;

const creditedStyle = {
  display:"grid",
  gridTemplateColumns:"1fr auto auto",
  gap:16,
  alignItems:"center",
  padding:14,
  border:"1px solid rgba(105,183,231,.13)",
  borderRadius:12,
  background:"rgba(4,16,32,.28)"
} as const;

const organizationStyle = {
  padding:"9px 11px",
  border:"1px solid rgba(105,183,231,.13)",
  borderRadius:999,
  background:"rgba(4,16,32,.28)"
} as const;
