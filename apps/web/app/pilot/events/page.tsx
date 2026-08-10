import type {Metadata} from "next";
import type {ReactNode} from "react";
import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {
  joinGlobalEventAction,
  withdrawGlobalEventAction
} from "./actions";

export const metadata: Metadata = {
  title: "Global Aviation Events | KVA OS",
  description: "Shared aviation events across the KVA OS network."
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Participation = {
  id: string;
  status: "joined" | "completed" | "withdrawn";
  organizationId: string;
  completedFlights: number;
  targetFlights: number;
  points: number;
  joinedAt: string;
  completedAt: string | null;
};

type Achievement = {
  id: string;
  badgeCode: string;
  badgeName: string;
  awardedAt: string;
};

type Organization = {
  id: string;
  code: string;
  name: string;
  role: string;
};

type GlobalEvent = {
  id: string;
  code: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  lifecycleStatus: string;
  phase: "upcoming" | "live" | "completed" | "cancelled";
  registrationOpen: boolean;
  startsAt: string;
  endsAt: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  requiredFlights: number;
  badgeCode: string;
  badgeName: string;
  routeCount: number;
  participants: number;
  completedParticipants: number;
  creditedFlights: number;
  organizations: Organization[];
  myParticipation: Participation | null;
  myAchievement: Achievement | null;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function progressPercent(participation: Participation | null) {
  if (!participation || participation.targetFlights <= 0) return 0;

  return Math.min(
    100,
    Math.round(
      participation.completedFlights /
        participation.targetFlights *
        100
    )
  );
}

export default async function GlobalEventsHubPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const message = first(params.message);
  const errorMessage = first(params.error);
  const supabase = await createClient();

  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  const {data, error} = await supabase.rpc(
    "get_global_aviation_event_hub"
  );

  if (error) {
    throw new Error(
      `Unable to load Global Aviation Events: ${error.message}`
    );
  }

  const events = (data ?? []) as unknown as GlobalEvent[];
  const live = events.filter((event) => event.phase === "live");
  const upcoming = events.filter(
    (event) => event.phase === "upcoming"
  );
  const history = events.filter(
    (event) =>
      event.phase === "completed" ||
      event.phase === "cancelled"
  );
  const joined = events.filter(
    (event) =>
      event.myParticipation &&
      event.myParticipation.status !== "withdrawn"
  );
  const completed = events.filter(
    (event) => event.myParticipation?.status === "completed"
  );

  return (
    <main style={{minHeight:"100vh",background:"var(--bg)"}}>
      <section style={{
        padding:"74px 20px 120px",
        background:
          "radial-gradient(circle at 78% 24%,rgba(0,174,239,.27),transparent 30%),linear-gradient(145deg,#06152d,#0b2344 58%,#124d79)"
      }}>
        <div style={{maxWidth:1180,margin:"0 auto"}}>
          <div style={{
            display:"flex",
            justifyContent:"space-between",
            gap:20,
            alignItems:"flex-start",
            flexWrap:"wrap"
          }}>
            <div>
              <Link
                href="/pilot/dashboard"
                style={{color:"var(--accent)",fontWeight:850}}
              >
                ← Pilot Dashboard
              </Link>
              <p className="eyebrow" style={{marginTop:34}}>
                KVA OS · Pillar 07
              </p>
              <h1 style={{
                margin:"12px 0 18px",
                fontSize:"clamp(3.4rem,8vw,6.3rem)",
                lineHeight:.92,
                letterSpacing:"-.06em"
              }}>
                Global Aviation Events
              </h1>
              <p style={{
                maxWidth:860,
                margin:0,
                color:"var(--muted)",
                lineHeight:1.8
              }}>
                Join shared aviation campaigns, fly event missions, track live
                progress and preserve every completed event as part of your
                KVA OS aviation journey.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section style={{padding:"0 20px 100px"}}>
        <div style={{
          maxWidth:1180,
          margin:"0 auto",
          display:"grid",
          gap:24,
          transform:"translateY(-46px)"
        }}>
          {message ? <Notice success>{message}</Notice> : null}
          {errorMessage ? <Notice>{errorMessage}</Notice> : null}

          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",
            gap:12
          }}>
            <Stat
              label="Live Events"
              value={String(live.length)}
              subValue="Running across the network"
            />
            <Stat
              label="Upcoming"
              value={String(upcoming.length)}
              subValue="Scheduled global events"
            />
            <Stat
              label="Joined"
              value={String(joined.length)}
              subValue="Your event participation"
            />
            <Stat
              label="Completed"
              value={String(completed.length)}
              subValue="Your finished events"
            />
            <Stat
              label="Event Flights"
              value={String(
                events.reduce(
                  (sum, event) =>
                    sum + (event.myParticipation?.completedFlights ?? 0),
                  0
                )
              )}
              subValue="Flights credited to your events"
            />
          </div>

          <EventSection
            eyebrow="Live Network"
            title="Live Events"
            events={live}
            empty="No global aviation event is live right now."
          />

          <EventSection
            eyebrow="Next on the Network"
            title="Upcoming Events"
            events={upcoming}
            empty="No upcoming events are currently published."
          />

          <EventSection
            eyebrow="Event History"
            title="Completed & Archived"
            events={history}
            empty="Event history will appear here after the first campaign ends."
          />

          <section style={panelStyle}>
            <p className="eyebrow">Network Principle</p>
            <h2 style={{margin:"8px 0 10px"}}>
              One flight can become part of a larger aviation story
            </h2>
            <p style={{
              margin:0,
              color:"var(--muted)",
              lineHeight:1.8
            }}>
              Event credit is evidence-based. A flight only counts after you
              join the event, fly an eligible event route during the event
              window and submit the recorded PIREP. Historical flights are not
              silently credited.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}

function EventSection({
  eyebrow,
  title,
  events,
  empty
}: {
  eyebrow:string;
  title:string;
  events:GlobalEvent[];
  empty:string;
}) {
  return (
    <section style={{display:"grid",gap:15}}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 style={{margin:"8px 0 0"}}>{title}</h2>
      </div>

      {events.length ? (
        <div style={{display:"grid",gap:14}}>
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <div style={{...panelStyle,color:"var(--muted)"}}>
          {empty}
        </div>
      )}
    </section>
  );
}

function EventCard({event}: {event:GlobalEvent}) {
  const participation = event.myParticipation;
  const percent = progressPercent(participation);
  const host =
    event.organizations.find((organization) => organization.role === "host") ??
    event.organizations[0];

  return (
    <article style={panelStyle}>
      <div style={{
        display:"flex",
        justifyContent:"space-between",
        gap:20,
        alignItems:"flex-start",
        flexWrap:"wrap"
      }}>
        <div style={{maxWidth:780}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Badge value={event.phase} />
            <Badge value={event.category.replaceAll("_"," ")} />
            {participation ? (
              <Badge value={participation.status} />
            ) : null}
          </div>

          <p className="eyebrow" style={{marginTop:17}}>
            {event.code}
          </p>
          <h2 style={{
            margin:"8px 0 10px",
            fontSize:"clamp(1.8rem,4vw,2.7rem)"
          }}>
            {event.title}
          </h2>
          <p style={{
            margin:0,
            color:"var(--muted)",
            lineHeight:1.75
          }}>
            {event.description}
          </p>
        </div>

        <div style={{
          minWidth:190,
          padding:17,
          border:"1px solid var(--border)",
          borderRadius:15,
          background:"rgba(4,16,32,.3)"
        }}>
          <small style={{color:"var(--muted)",fontWeight:850}}>
            EVENT WINDOW
          </small>
          <strong style={{display:"block",marginTop:9}}>
            {formatDate(event.startsAt)}
          </strong>
          <span style={{display:"block",marginTop:4,color:"var(--muted)"}}>
            to {formatDate(event.endsAt)}
          </span>
        </div>
      </div>

      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",
        gap:10,
        marginTop:18
      }}>
        <Metric
          label="Host"
          value={host ? `${host.code} · ${host.name}` : "KVA OS"}
        />
        <Metric label="Missions" value={String(event.routeCount)} />
        <Metric label="Participants" value={String(event.participants)} />
        <Metric
          label="Completed Pilots"
          value={String(event.completedParticipants)}
        />
        <Metric label="Event Flights" value={String(event.creditedFlights)} />
        <Metric
          label="Reward"
          value={event.badgeName}
        />
      </div>

      {participation && participation.status !== "withdrawn" ? (
        <section style={{...innerPanelStyle,marginTop:16}}>
          <div style={{
            display:"flex",
            justifyContent:"space-between",
            gap:16,
            flexWrap:"wrap"
          }}>
            <div>
              <p className="eyebrow">Your Progress</p>
              <strong style={{fontSize:"1.3rem"}}>
                {participation.completedFlights}/{participation.targetFlights}
                {" "}eligible flights
              </strong>
            </div>
            <strong style={{fontSize:"1.5rem"}}>{percent}%</strong>
          </div>

          <div style={{
            height:10,
            marginTop:13,
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

          {event.myAchievement ? (
            <div style={{
              marginTop:13,
              color:"#98efbf",
              fontWeight:850
            }}>
              Achievement unlocked: {event.myAchievement.badgeName}
            </div>
          ) : null}
        </section>
      ) : null}

      <div style={{
        display:"flex",
        justifyContent:"space-between",
        gap:12,
        alignItems:"center",
        flexWrap:"wrap",
        marginTop:17
      }}>
        <Link className="button" href={`/pilot/events/${event.slug}`}>
          Open event
        </Link>

        {!participation || participation.status === "withdrawn" ? (
          event.registrationOpen ? (
            <form action={joinGlobalEventAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="slug" value="" />
              <button className="button outline" type="submit">
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
            <input type="hidden" name="slug" value="" />
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
    </article>
  );
}

function Badge({value}: {value:string}) {
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

function Metric({label,value}: {label:string;value:string}) {
  return (
    <article style={{
      padding:14,
      border:"1px solid rgba(105,183,231,.13)",
      borderRadius:12,
      background:"rgba(4,16,32,.3)"
    }}>
      <small style={{color:"var(--muted)",fontWeight:850}}>
        {label.toUpperCase()}
      </small>
      <strong style={{
        display:"block",
        marginTop:8,
        overflowWrap:"anywhere"
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

function Stat({
  label,
  value,
  subValue
}: {
  label:string;
  value:string;
  subValue:string;
}) {
  return (
    <article style={{
      minHeight:130,
      padding:21,
      border:"1px solid var(--border)",
      borderRadius:17,
      background:"var(--surface)"
    }}>
      <small style={{
        color:"var(--muted)",
        fontWeight:850,
        letterSpacing:".06em"
      }}>
        {label.toUpperCase()}
      </small>
      <strong style={{
        display:"block",
        marginTop:15,
        fontSize:"2rem"
      }}>
        {value}
      </strong>
      <span style={{
        display:"block",
        marginTop:7,
        color:"var(--muted)",
        fontSize:".78rem"
      }}>
        {subValue}
      </span>
    </article>
  );
}

const panelStyle = {
  padding:22,
  border:"1px solid var(--border)",
  borderRadius:20,
  background:"var(--surface)"
} as const;

const innerPanelStyle = {
  padding:17,
  border:"1px solid rgba(105,183,231,.13)",
  borderRadius:15,
  background:"rgba(4,16,32,.28)"
} as const;
