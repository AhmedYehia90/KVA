import type {Metadata} from "next";
import Link from "next/link";
import {notFound, redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import AirportLocalClock from "@/components/airports/AirportLocalClock";

export const metadata: Metadata = {
  title: "Airport World | KVA OS",
  description: "Living Airport detail inside the KVA OS world.",
};

export const dynamic = "force-dynamic";

type DetailData = {
  disclaimer: string;
  airport: {
    id: string;
    icaoCode: string;
    iataCode?: string | null;
    name: string;
    city?: string | null;
    country?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    timezone?: string | null;
  };
  pulse: {
    score: number;
    label: string;
    activeRoutes: number;
    parkedAircraft: number;
    liveMovements: number;
    completed24h: number;
    activeEvents: number;
    activeNotices: number;
    routeInterestSignals: number;
  };
  pilotHistory: {
    completedVisits?: number;
    departures?: number;
    arrivals?: number;
    firstVisitAt?: string | null;
    latestVisitAt?: string | null;
  };
  liveBoard: Array<{
    bookingId: string;
    flightNumber: string;
    status: string;
    direction: string;
    otherAirport?: string | null;
    otherAirportName?: string | null;
    aircraftRegistration?: string | null;
    fleetIcao?: string | null;
    pilotCallsign?: string | null;
    lastEventAt?: string | null;
  }>;
  groundFleet: Array<{
    aircraftId: string;
    registration: string;
    status: string;
    fleetIcao?: string | null;
    manufacturer?: string | null;
    model?: string | null;
  }>;
  network: Array<{
    airportId: string;
    icaoCode: string;
    name: string;
    city?: string | null;
    routeCount: number;
    fleetTypes: string[];
  }>;
  globalEvents: Array<{
    eventId: string;
    eventCode: string;
    slug: string;
    title: string;
    category: string;
    startsAt: string;
    endsAt: string;
    missionLabel: string;
    points: number;
    flightNumber: string;
    route: string;
  }>;
  notices: Array<{
    noticeId: string;
    publisherOrganizationId: string;
    category: string;
    severity: string;
    title: string;
    message: string;
    startsAt: string;
    endsAt?: string | null;
    state: string;
    sourceLabel?: string | null;
    sourceReference?: string | null;
  }>;
  routeSupport: Array<{
    campaignId: string;
    code: string;
    title: string;
    status: string;
    fundedAmount: number;
    targetAmount: number;
    route: string;
    operationsNote?: string | null;
  }>;
  recentActivity: Array<{
    bookingId: string;
    flightNumber: string;
    completedAt: string;
    route: string;
    direction: string;
  }>;
};

function dateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function number(value?: number | null) {
  return new Intl.NumberFormat("en-US").format(Number(value ?? 0));
}

export default async function AirportDetailPage({
  params,
}: {
  params: Promise<{icao: string}>;
}) {
  const {icao} = await params;

  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  const {data, error} = await supabase.rpc("get_living_airport_detail", {
    p_icao_code: icao,
  });

  if (error) {
    throw new Error(`Unable to load Living Airport: ${error.message}`);
  }

  if (!data) notFound();

  const world = data as unknown as DetailData;
  const airport = world.airport;
  const pulse = world.pulse;
  const history = world.pilotHistory ?? {};
  const live = Array.isArray(world.liveBoard) ? world.liveBoard : [];
  const fleet = Array.isArray(world.groundFleet) ? world.groundFleet : [];
  const network = Array.isArray(world.network) ? world.network : [];
  const events = Array.isArray(world.globalEvents) ? world.globalEvents : [];
  const notices = Array.isArray(world.notices) ? world.notices : [];
  const support = Array.isArray(world.routeSupport) ? world.routeSupport : [];
  const recent = Array.isArray(world.recentActivity)
    ? world.recentActivity
    : [];

  return (
    <main
      style={{
        minHeight: "calc(100vh - 80px)",
        padding: "72px 20px 110px",
        background:
          "radial-gradient(circle at 84% 5%,rgba(24,167,224,.20),transparent 30%),radial-gradient(circle at 10% 52%,rgba(7,43,90,.34),transparent 36%),var(--bg)",
      }}
    >
      <div style={{maxWidth: 1180, margin: "0 auto"}}>
        <Link className="button outline" href="/airports">
          ← Living Airports
        </Link>

        <section style={hero}>
          <div>
            <p className="eyebrow">KVA OS · LIVING AIRPORT</p>
            <h1 style={heroTitle}>
              {airport.icaoCode}
              {airport.iataCode ? ` / ${airport.iataCode}` : ""}
            </h1>
            <h2 style={{margin: "0 0 8px", fontSize: "1.55rem"}}>
              {airport.name}
            </h2>
            <p style={muted}>
              {airport.city ?? "—"}
              {airport.country ? ` · ${airport.country}` : ""}
            </p>
            <p style={{...muted, marginTop: 12}}>
              <AirportLocalClock timezone={airport.timezone} />
            </p>
          </div>

          <div style={pulseCard}>
            <small style={label}>KVA OS AIRPORT PULSE</small>
            <strong style={{display: "block", marginTop: 8, fontSize: "3rem"}}>
              {pulse.score}
            </strong>
            <span style={{color: "#79d9ff", fontWeight: 900}}>
              {pulse.label}
            </span>
            <p style={{...muted, marginTop: 9}}>
              Platform activity only — not a real-world traffic status.
            </p>
          </div>
        </section>

        <section style={stats}>
          <Stat label="LIVE MOVEMENTS" value={number(pulse.liveMovements)} />
          <Stat label="COMPLETED · 24H" value={number(pulse.completed24h)} />
          <Stat label="AIRCRAFT ON GROUND" value={number(pulse.parkedAircraft)} />
          <Stat label="ACTIVE ROUTES" value={number(pulse.activeRoutes)} />
          <Stat label="GLOBAL EVENT LINKS" value={number(pulse.activeEvents)} />
          <Stat label="WORLD NOTICES" value={number(pulse.activeNotices)} />
        </section>

        <section style={{marginTop: 38}}>
          <p className="eyebrow">YOUR CONNECTION</p>
          <h2 style={sectionTitle}>Your history with {airport.icaoCode}</h2>
          <div style={connectionGrid}>
            <Connection
              label="COMPLETED VISITS"
              value={number(history.completedVisits)}
            />
            <Connection label="DEPARTURES" value={number(history.departures)} />
            <Connection label="ARRIVALS" value={number(history.arrivals)} />
            <Connection
              label="FIRST RECORDED VISIT"
              value={dateTime(history.firstVisitAt)}
              compact
            />
            <Connection
              label="LATEST RECORDED VISIT"
              value={dateTime(history.latestVisitAt)}
              compact
            />
          </div>
        </section>

        <section style={{marginTop: 42}}>
          <div style={sectionHead}>
            <div>
              <p className="eyebrow">LIVE AIRPORT BOARD</p>
              <h2 style={sectionTitle}>Flights touching this airport now</h2>
            </div>
            <small style={{color: "var(--muted)"}}>
              Event-driven KVA OS flight state
            </small>
          </div>

          <div style={{display: "grid", gap: 12, marginTop: 18}}>
            {live.length ? (
              live.map((item) => (
                <article key={item.bookingId} style={movementCard}>
                  <div>
                    <small style={{...label, color: "#79d9ff"}}>
                      {item.direction.toUpperCase()} · {item.status.toUpperCase()}
                    </small>
                    <h3 style={{margin: "8px 0 5px"}}>
                      {item.flightNumber} · {airport.icaoCode}{" "}
                      {item.direction === "departure" ? "→" : "←"}{" "}
                      {item.otherAirport ?? "—"}
                    </h3>
                    <p style={muted}>
                      {item.fleetIcao ?? "Aircraft"}{" "}
                      {item.aircraftRegistration
                        ? `· ${item.aircraftRegistration}`
                        : ""}
                      {item.pilotCallsign ? ` · ${item.pilotCallsign}` : ""}
                    </p>
                  </div>
                  <time style={timeText}>{dateTime(item.lastEventAt)}</time>
                </article>
              ))
            ) : (
              <Empty text="No live KVA OS movement is touching this airport right now." />
            )}
          </div>
        </section>

        <section style={twoColumn}>
          <Panel title="Fleet on Ground" eyebrow="AIRCRAFT PRESENCE">
            {fleet.length ? (
              <div style={listGrid}>
                {fleet.map((item) => (
                  <div key={item.aircraftId} style={inner}>
                    <strong>{item.registration}</strong>
                    <span style={sub}>
                      {item.fleetIcao ?? "—"} · {item.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="No KVA OS aircraft currently reports this airport as its ground location." />
            )}
          </Panel>

          <Panel title="Route Network" eyebrow="CONNECTED DESTINATIONS">
            {network.length ? (
              <div style={listGrid}>
                {network.map((item) => (
                  <Link
                    key={item.airportId}
                    href={`/airports/${item.icaoCode}`}
                    style={innerLink}
                  >
                    <strong>{item.icaoCode} · {item.name}</strong>
                    <span style={sub}>
                      {item.routeCount} route links
                      {item.fleetTypes?.length
                        ? ` · ${item.fleetTypes.join(", ")}`
                        : ""}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty text="No active KVA OS route connection is recorded." />
            )}
          </Panel>
        </section>

        <section style={twoColumn}>
          <Panel title="Global Aviation Events" eyebrow="WORLD EVENTS">
            {events.length ? (
              <div style={listGrid}>
                {events.map((item) => (
                  <div
                    key={`${item.eventId}:${item.flightNumber}`}
                    style={inner}
                  >
                    <small style={{...label, color: "#79d9ff"}}>
                      {item.eventCode} · {item.missionLabel}
                    </small>
                    <strong style={{display: "block", marginTop: 6}}>
                      {item.title}
                    </strong>
                    <span style={sub}>
                      {item.route} · {dateTime(item.startsAt)} →{" "}
                      {dateTime(item.endsAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="No published Global Aviation Event currently links to this airport." />
            )}
          </Panel>

          <Panel title="Route Interest" eyebrow="COMMUNITY SIGNALS">
            {support.length ? (
              <div style={listGrid}>
                {support.map((item) => (
                  <div key={item.campaignId} style={inner}>
                    <small style={{...label, color: "#79d9ff"}}>
                      {item.status.toUpperCase()}
                    </small>
                    <strong style={{display: "block", marginTop: 6}}>
                      {item.route} · {item.title}
                    </strong>
                    <span style={sub}>
                      {number(item.fundedAmount)} / {number(item.targetAmount)} KVC
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="No active Route Support interest signal touches this airport." />
            )}
          </Panel>
        </section>

        <section style={{marginTop: 24}}>
          <Panel title="Airport World Notices" eyebrow="KVA OS CONTEXT">
            <p style={{...muted, marginBottom: 16}}>
              These are published KVA OS platform/airline notices. They are not
              real-world NOTAM, ATC, weather or closure authority.
            </p>

            {notices.length ? (
              <div style={listGrid}>
                {notices.map((item) => (
                  <div key={item.noticeId} style={noticeCard}>
                    <div style={sectionHead}>
                      <small style={{...label, color: "#79d9ff"}}>
                        {item.category.toUpperCase()} · {item.severity.toUpperCase()} ·{" "}
                        {item.state.toUpperCase()}
                      </small>
                      <span style={timeText}>{dateTime(item.startsAt)}</span>
                    </div>
                    <h3 style={{margin: "9px 0 6px"}}>{item.title}</h3>
                    <p style={muted}>{item.message}</p>
                    {item.sourceLabel ? (
                      <span style={{...sub, marginTop: 10}}>
                        Source: {item.sourceLabel}
                        {item.sourceReference
                          ? ` · ${item.sourceReference}`
                          : ""}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="No published KVA OS airport notice is active or upcoming." />
            )}
          </Panel>
        </section>

        <section style={{marginTop: 24}}>
          <Panel title="Recent Airport Activity" eyebrow="RECORDED MOVEMENTS">
            {recent.length ? (
              <div style={listGrid}>
                {recent.map((item) => (
                  <div key={item.bookingId} style={inner}>
                    <small style={{...label, color: "#79d9ff"}}>
                      {item.direction.toUpperCase()}
                    </small>
                    <strong style={{display: "block", marginTop: 6}}>
                      {item.flightNumber} · {item.route}
                    </strong>
                    <span style={sub}>{dateTime(item.completedAt)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="No completed KVA OS movement is recorded at this airport yet." />
            )}
          </Panel>
        </section>

        <section style={integrity}>
          <strong>Evidence creates the airport world.</strong>
          <span style={{color: "var(--muted)"}}>
            Browsing Living Airports cannot change flights, fleet, routes,
            PIREPs, Career XP, KVC balances or Economy Ledger.
          </span>
        </section>
      </div>
    </main>
  );
}

function Stat({label: statLabel, value}: {label: string; value: string}) {
  return (
    <article style={statCard}>
      <small style={label}>{statLabel}</small>
      <strong style={{display: "block", marginTop: 9, fontSize: "1.55rem"}}>
        {value}
      </strong>
    </article>
  );
}

function Connection({
  label: connectionLabel,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <article style={connectionCard}>
      <small style={label}>{connectionLabel}</small>
      <strong
        style={{
          display: "block",
          marginTop: 8,
          fontSize: compact ? "1rem" : "1.4rem",
        }}
      >
        {value}
      </strong>
    </article>
  );
}

function Panel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section style={panel}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 style={{margin: "8px 0 18px", fontSize: "1.65rem"}}>{title}</h2>
      {children}
    </section>
  );
}

function Empty({text}: {text: string}) {
  return <div style={empty}>{text}</div>;
}

const hero = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 28,
  flexWrap: "wrap",
  padding: "30px 0 22px",
} as const;

const heroTitle = {
  margin: "11px 0 7px",
  fontSize: "clamp(4rem,9vw,7rem)",
  letterSpacing: "-.065em",
} as const;

const pulseCard = {
  minWidth: 260,
  padding: 22,
  border: "1px solid rgba(24,167,224,.30)",
  borderRadius: 20,
  background:
    "linear-gradient(145deg,rgba(7,43,90,.54),rgba(4,16,32,.54))",
} as const;

const stats = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
  gap: 12,
  marginTop: 14,
} as const;

const statCard = {
  padding: 18,
  border: "1px solid var(--border)",
  borderRadius: 17,
  background: "rgba(4,16,32,.42)",
} as const;

const sectionTitle = {
  margin: "8px 0 0",
  fontSize: "2rem",
} as const;

const sectionHead = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "center",
  flexWrap: "wrap",
} as const;

const connectionGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 12,
  marginTop: 18,
} as const;

const connectionCard = {
  padding: 18,
  border: "1px solid var(--border)",
  borderRadius: 17,
  background: "rgba(4,16,32,.38)",
} as const;

const movementCard = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  flexWrap: "wrap",
  padding: 20,
  border: "1px solid rgba(24,167,224,.20)",
  borderRadius: 18,
  background: "rgba(4,16,32,.38)",
} as const;

const twoColumn = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))",
  gap: 16,
  marginTop: 24,
} as const;

const panel = {
  padding: 22,
  border: "1px solid var(--border)",
  borderRadius: 21,
  background:
    "linear-gradient(155deg,rgba(9,35,67,.64),rgba(4,16,32,.56))",
} as const;

const listGrid = {
  display: "grid",
  gap: 10,
} as const;

const inner = {
  padding: 15,
  border: "1px solid rgba(105,183,231,.14)",
  borderRadius: 14,
  background: "rgba(4,16,32,.22)",
} as const;

const innerLink = {
  ...inner,
  display: "block",
  color: "inherit",
  textDecoration: "none",
} as const;

const noticeCard = {
  padding: 17,
  border: "1px solid rgba(121,217,255,.18)",
  borderRadius: 15,
  background: "rgba(24,167,224,.045)",
} as const;

const empty = {
  padding: 20,
  border: "1px dashed var(--border)",
  borderRadius: 14,
  color: "var(--muted)",
  lineHeight: 1.6,
} as const;

const integrity = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  flexWrap: "wrap",
  marginTop: 38,
  padding: 21,
  border: "1px solid rgba(24,167,224,.20)",
  borderRadius: 18,
  background: "rgba(24,167,224,.055)",
} as const;

const muted = {
  margin: 0,
  color: "var(--muted)",
  lineHeight: 1.6,
} as const;

const sub = {
  display: "block",
  marginTop: 5,
  color: "var(--muted)",
  fontSize: ".82rem",
} as const;

const timeText = {
  color: "var(--muted)",
  fontSize: ".8rem",
} as const;

const label = {
  fontSize: ".72rem",
  fontWeight: 850,
  letterSpacing: ".09em",
} as const;
