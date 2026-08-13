import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import AirportLocalClock from "@/components/airports/AirportLocalClock";

export const metadata: Metadata = {
  title: "Living Airports | KVA OS",
  description: "The KVA OS aviation world-awareness layer.",
};

export const dynamic = "force-dynamic";

type AirportRow = {
  id: string;
  icaoCode: string;
  iataCode?: string | null;
  name: string;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  activeRoutes: number;
  parkedAircraft: number;
  liveMovements: number;
  completed24h: number;
  activeEvents: number;
  activeNotices: number;
  routeInterestSignals: number;
  pulseScore: number;
  pulseLabel: string;
};

type WorldData = {
  schemaVersion: number;
  projection: string;
  authority: string;
  generatedAt: string;
  disclaimer: string;
  summary: {
    airports: number;
    liveMovements: number;
    activeNotices: number;
    activeGlobalEventLinks: number;
  };
  airports: AirportRow[];
};

function pulseText(score: number) {
  if (score >= 70) return "The airport is highly active inside KVA OS right now.";
  if (score >= 40) return "Several KVA OS signals are active around this airport.";
  if (score >= 10) return "There is current KVA OS activity around this airport.";
  return "The airport is quiet inside KVA OS at this moment.";
}

export default async function LivingAirportsPage() {
  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  const {data, error} = await supabase.rpc("get_living_airports_world");

  if (error) {
    throw new Error(`Unable to load Living Airports: ${error.message}`);
  }

  const world = data as unknown as WorldData;
  const airports = Array.isArray(world?.airports) ? world.airports : [];
  const summary = world?.summary ?? {
    airports: 0,
    liveMovements: 0,
    activeNotices: 0,
    activeGlobalEventLinks: 0,
  };

  const spotlight = airports[0];

  return (
    <main
      style={{
        minHeight: "calc(100vh - 80px)",
        padding: "74px 20px 110px",
        background:
          "radial-gradient(circle at 82% 6%, rgba(24,167,224,.20), transparent 31%), radial-gradient(circle at 15% 45%, rgba(7,43,90,.36), transparent 36%), var(--bg)",
      }}
    >
      <div style={{maxWidth: 1180, margin: "0 auto"}}>
        <section style={hero}>
          <div style={{maxWidth: 810}}>
            <p className="eyebrow">KVA OS · PILLAR 10 · WORLD AWARENESS</p>
            <h1 style={heroTitle}>Living Airports</h1>
            <p style={heroText}>
              Airports become living nodes in the KVA OS world — connected to
              live flight evidence, fleet presence, route networks, Global
              Aviation Events, community route interest and published platform
              notices.
            </p>
          </div>

          <div style={worldCard}>
            <small style={label}>WORLD STATUS</small>
            <strong style={{display: "block", marginTop: 9, fontSize: "1.35rem"}}>
              {summary.airports} connected airports
            </strong>
            <span style={sub}>
              {summary.liveMovements} live movement links ·{" "}
              {summary.activeGlobalEventLinks} event links
            </span>
          </div>
        </section>

        <section style={stats}>
          <Stat label="CONNECTED AIRPORTS" value={String(summary.airports)} />
          <Stat label="LIVE MOVEMENT LINKS" value={String(summary.liveMovements)} />
          <Stat label="ACTIVE WORLD NOTICES" value={String(summary.activeNotices)} />
          <Stat
            label="GLOBAL EVENT LINKS"
            value={String(summary.activeGlobalEventLinks)}
          />
        </section>

        {spotlight ? (
          <section style={spotlightCard}>
            <div>
              <p className="eyebrow">AIRPORT SPOTLIGHT</p>
              <h2 style={{margin: "8px 0 7px", fontSize: "2.3rem"}}>
                {spotlight.icaoCode} · {spotlight.name}
              </h2>
              <p style={muted}>
                {spotlight.city ?? "Airport"}
                {spotlight.country ? `, ${spotlight.country}` : ""}
              </p>
              <p style={{...muted, marginTop: 12}}>
                <AirportLocalClock timezone={spotlight.timezone} />
              </p>
            </div>

            <div style={pulseBox}>
              <small style={label}>KVA OS PULSE</small>
              <strong style={{display: "block", marginTop: 8, fontSize: "2.25rem"}}>
                {spotlight.pulseScore}
              </strong>
              <span style={{display: "block", marginTop: 3, color: "#79d9ff", fontWeight: 850}}>
                {spotlight.pulseLabel}
              </span>
              <p style={{...muted, marginTop: 9, maxWidth: 280}}>
                {pulseText(spotlight.pulseScore)}
              </p>
              <Link
                className="button"
                href={`/airports/${spotlight.icaoCode}`}
                style={{display: "inline-flex", marginTop: 14}}
              >
                Enter Airport
              </Link>
            </div>
          </section>
        ) : null}

        <section style={{marginTop: 44}}>
          <div style={sectionHead}>
            <div>
              <p className="eyebrow">KVA OS AIRPORT NETWORK</p>
              <h2 style={sectionTitle}>The world at a glance</h2>
            </div>
            <small style={{maxWidth: 430, color: "var(--muted)", lineHeight: 1.55}}>
              Pulse is a KVA OS activity score derived from platform evidence.
              It is not a real-world airport traffic or operational status.
            </small>
          </div>

          <div style={grid}>
            {airports.map((airport) => (
              <Link
                key={airport.id}
                href={`/airports/${airport.icaoCode}`}
                style={airportCard}
              >
                <div style={cardTop}>
                  <div>
                    <small style={{...label, color: "#79d9ff"}}>
                      {airport.iataCode
                        ? `${airport.icaoCode} / ${airport.iataCode}`
                        : airport.icaoCode}
                    </small>
                    <h3 style={{margin: "8px 0 4px", fontSize: "1.15rem"}}>
                      {airport.name}
                    </h3>
                    <span style={sub}>
                      {airport.city ?? "—"}
                      {airport.country ? ` · ${airport.country}` : ""}
                    </span>
                  </div>
                  <div style={miniPulse}>
                    <strong>{airport.pulseScore}</strong>
                    <small>{airport.pulseLabel}</small>
                  </div>
                </div>

                <div style={divider} />

                <div style={miniGrid}>
                  <Mini label="LIVE" value={airport.liveMovements} />
                  <Mini label="24H" value={airport.completed24h} />
                  <Mini label="FLEET" value={airport.parkedAircraft} />
                  <Mini label="ROUTES" value={airport.activeRoutes} />
                  <Mini label="EVENTS" value={airport.activeEvents} />
                  <Mini label="NOTICES" value={airport.activeNotices} />
                </div>

                <p style={{...muted, marginTop: 15}}>
                  <AirportLocalClock timezone={airport.timezone} />
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section style={integrity}>
          <strong>World-awareness, not real-world authority.</strong>
          <span style={{color: "var(--muted)"}}>
            Living Airports does not claim real NOTAM, weather, ATC, closure or
            traffic status unless a future verified external source is explicitly integrated.
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
      <strong style={{display: "block", marginTop: 9, fontSize: "1.6rem"}}>
        {value}
      </strong>
    </article>
  );
}

function Mini({label: miniLabel, value}: {label: string; value: number}) {
  return (
    <div>
      <small style={{...label, color: "var(--muted)"}}>{miniLabel}</small>
      <strong style={{display: "block", marginTop: 4}}>{value}</strong>
    </div>
  );
}

const hero = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 28,
  flexWrap: "wrap",
  padding: "26px 0",
} as const;

const heroTitle = {
  margin: "12px 0 14px",
  fontSize: "clamp(3.2rem,7vw,6rem)",
  letterSpacing: "-.06em",
} as const;

const heroText = {
  margin: 0,
  color: "var(--muted)",
  fontSize: "1.05rem",
  lineHeight: 1.8,
} as const;

const worldCard = {
  minWidth: 270,
  padding: "22px 24px",
  border: "1px solid rgba(24,167,224,.30)",
  borderRadius: 20,
  background:
    "linear-gradient(145deg, rgba(7,43,90,.54), rgba(4,16,32,.54))",
} as const;

const stats = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 12,
  marginTop: 14,
} as const;

const statCard = {
  padding: 19,
  border: "1px solid var(--border)",
  borderRadius: 17,
  background: "rgba(4,16,32,.42)",
} as const;

const spotlightCard = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "stretch",
  gap: 22,
  flexWrap: "wrap",
  marginTop: 32,
  padding: 26,
  border: "1px solid rgba(24,167,224,.24)",
  borderRadius: 23,
  background:
    "linear-gradient(135deg,rgba(8,42,78,.74),rgba(4,16,32,.50))",
} as const;

const pulseBox = {
  minWidth: 260,
  padding: 20,
  border: "1px solid rgba(121,217,255,.18)",
  borderRadius: 18,
  background: "rgba(4,16,32,.30)",
} as const;

const sectionHead = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "end",
  gap: 18,
  flexWrap: "wrap",
} as const;

const sectionTitle = {
  margin: "8px 0 0",
  fontSize: "2rem",
} as const;

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))",
  gap: 14,
  marginTop: 20,
} as const;

const airportCard = {
  display: "block",
  padding: 21,
  border: "1px solid var(--border)",
  borderRadius: 20,
  background:
    "linear-gradient(155deg,rgba(9,35,67,.68),rgba(4,16,32,.58))",
  color: "inherit",
  textDecoration: "none",
} as const;

const cardTop = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
} as const;

const miniPulse = {
  minWidth: 72,
  textAlign: "right",
} as const;

const miniGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3,1fr)",
  gap: 12,
} as const;

const divider = {
  height: 1,
  margin: "16px 0",
  background: "var(--border)",
} as const;

const integrity = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  flexWrap: "wrap",
  marginTop: 42,
  padding: 21,
  border: "1px solid rgba(24,167,224,.20)",
  borderRadius: 18,
  background: "rgba(24,167,224,.055)",
} as const;

const label = {
  fontSize: ".72rem",
  fontWeight: 850,
  letterSpacing: ".09em",
} as const;

const sub = {
  display: "block",
  marginTop: 6,
  color: "var(--muted)",
  fontSize: ".82rem",
} as const;

const muted = {
  margin: 0,
  color: "var(--muted)",
  lineHeight: 1.55,
} as const;
