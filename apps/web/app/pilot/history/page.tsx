import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Museum & History | KVA OS",
  description: "Your long-term KVA OS aviation legacy.",
};

type Evidence = Record<string, unknown>;

type TimelineItem = {
  id: string;
  kind: string;
  occurredAt: string;
  title: string;
  description: string;
  evidence?: Evidence;
};

type MuseumData = {
  schemaVersion: number;
  projection: string;
  authority: string;
  summary: {
    journeySince?: string | null;
    passportNumber?: string | null;
    journeyYears: number;
    careerXp: number;
    completedFlights: number;
    flightMinutes: number;
    flightHours: number;
    currentRankCode: string;
    milestones: number;
    promotions: number;
    eventAchievements: number;
    aircraftTypesFlown: number;
  };
  memories: {
    firstCompletedFlight?: Record<string, unknown>;
    mostFlownAircraftType?: Record<string, unknown>;
    latestPromotion?: Record<string, unknown>;
    firstEventAchievement?: Record<string, unknown>;
  };
  timeline: TimelineItem[];
};

const kindLabel: Record<string, string> = {
  passport: "IDENTITY",
  flight: "FLIGHT MEMORY",
  career_milestone: "MILESTONE",
  career_promotion: "PROMOTION",
  qualification: "QUALIFICATION",
  event_achievement: "EVENT LEGACY",
};

function date(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {dateStyle: "medium"}).format(new Date(value));
}

function compactPassportNumber(value?: string | null) {
  if (!value) return "Universal Pilot Passport";
  if (value.length <= 20) return value;
  return `${value.slice(0, 12)}…${value.slice(-6)}`;
}

function text(value: unknown, fallback = "—") {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

export default async function PilotMuseumHistoryPage() {
  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  const {data, error} = await supabase.rpc("get_pilot_museum_history");

  if (error) {
    throw new Error(`Unable to load Museum & History: ${error.message}`);
  }

  const museum = data as unknown as MuseumData;
  const summary = museum?.summary ?? ({} as MuseumData["summary"]);
  const memories = museum?.memories ?? {};
  const timeline = Array.isArray(museum?.timeline) ? museum.timeline : [];

  const currentRankCode = summary.currentRankCode ?? "CADET";
  const {data: currentRankRow} = await supabase
    .from("ranks")
    .select("name")
    .eq("code", currentRankCode)
    .maybeSingle();

  const currentRankName = currentRankRow?.name ?? currentRankCode;

  const firstFlight = memories.firstCompletedFlight ?? {};
  const favoriteAircraft = memories.mostFlownAircraftType ?? {};
  const latestPromotion = memories.latestPromotion ?? {};
  const firstEvent = memories.firstEventAchievement ?? {};

  return (
    <main className="kvaPremiumSubpage">
      <section className="kvaPremiumHero">
        <div className="kvaPremiumHeroInner">
        <div className="kvaPremiumHeroNav">
          <Link className="button outline" href="/pilot/history/memories">
            Living Memories
          </Link>
          <Link className="button outline" href="/pilot/history/company">
            Airline Museum →
          </Link>
        </div>
        <section className="kvaPremiumHeroRow" style={hero}>
          <div>
            <p className="eyebrow">KVA OS · PILLAR 09</p>
            <h1 className="kvaPremiumHeroTitle">Museum & History</h1>
            <p className="kvaPremiumHeroText">
              Every completed operation, promotion, milestone, qualification and event achievement becomes part of one persistent aviation legacy.
            </p>
          </div>

          <div className="kvaPremiumHeroMetaCard kvaPremiumHeroSide" style={legacySeal}>
            <small style={label}>LEGACY SINCE</small>
            <strong style={{display: "block", marginTop: 8, fontSize: "1.2rem"}}>
              {date(summary.journeySince)}
            </strong>
            <span
              title={summary.passportNumber ?? undefined}
              style={{display: "block", marginTop: 7, color: "var(--muted)", fontSize: ".82rem"}}
            >
              {summary.passportNumber
                ? `Passport ${compactPassportNumber(summary.passportNumber)}`
                : "Universal Pilot Passport"}
            </span>
          </div>
          </section>
        </div>
      </section>

      <section className="kvaPremiumSubpageContent">
        <div className="kvaPremiumSubpageBody kvaPremiumSubpageBodyLift">
        <section style={statsGrid}>
          <Stat label="CAREER XP" value={String(summary.careerXp ?? 0)} />
          <Stat label="COMPLETED FLIGHTS" value={String(summary.completedFlights ?? 0)} />
          <Stat label="FLIGHT HOURS" value={String(summary.flightHours ?? 0)} />
          <Stat label="CURRENT RANK" value={currentRankName} />
          <Stat label="MILESTONES" value={String(summary.milestones ?? 0)} />
          <Stat label="AIRCRAFT TYPES" value={String(summary.aircraftTypesFlown ?? 0)} />
        </section>

        <section style={{marginTop: 38}}>
          <p className="eyebrow">CAREER MEMORIES</p>
          <h2 style={{margin: "8px 0 18px", fontSize: "2rem"}}>The moments that define the journey</h2>

          <div style={memoryGrid}>
            <Memory
              eyebrow="FIRST COMPLETED OPERATION"
              title={text(firstFlight.flightNumber, "Waiting for your first completed flight")}
              body={
                firstFlight.flightNumber
                  ? `${text(firstFlight.departureIcao)} → ${text(firstFlight.arrivalIcao)} · ${text(firstFlight.fleetIcao, "Aircraft pending")}`
                  : "Your first completed KVA OS operation will become a permanent memory here."
              }
              footer={firstFlight.occurredAt ? date(String(firstFlight.occurredAt)) : "Not recorded yet"}
            />

            <Memory
              eyebrow="MOST FLOWN AIRCRAFT"
              title={text(favoriteAircraft.fleetIcao, "No aircraft history yet")}
              body={
                favoriteAircraft.fleetIcao
                  ? `${text(favoriteAircraft.manufacturer)} ${text(favoriteAircraft.model)}`
                  : "Aircraft memories are derived from your completed operations."
              }
              footer={
                favoriteAircraft.completedFlights
                  ? `${text(favoriteAircraft.completedFlights)} completed flights`
                  : "Awaiting completed operations"
              }
            />

            <Memory
              eyebrow="LATEST PROMOTION"
              title={
                latestPromotion.toRankCode
                  ? `Promoted to ${text(latestPromotion.toRankCode)}`
                  : "Career promotion history"
              }
              body={
                latestPromotion.toRankCode
                  ? `${text(latestPromotion.completedFlights, "0")} flights · ${text(latestPromotion.careerXp, "0")} Career XP`
                  : "Your future promotions will be preserved as career legacy."
              }
              footer={latestPromotion.promotedAt ? date(String(latestPromotion.promotedAt)) : "No promotion recorded yet"}
            />

            <Memory
              eyebrow="FIRST EVENT LEGACY"
              title={text(firstEvent.badgeName, "No event achievement yet")}
              body={
                firstEvent.eventTitle
                  ? `Earned during ${text(firstEvent.eventTitle)}`
                  : "Completed Global Aviation Events will leave a permanent achievement here."
              }
              footer={firstEvent.awardedAt ? date(String(firstEvent.awardedAt)) : "Awaiting event achievement"}
            />
          </div>
        </section>

        <section style={{marginTop: 44}}>
          <div style={{display: "flex", alignItems: "end", justifyContent: "space-between", gap: 18, flexWrap: "wrap"}}>
            <div>
              <p className="eyebrow">YOUR AVIATION TIMELINE</p>
              <h2 style={{margin: "8px 0 0", fontSize: "2rem"}}>A record built from real KVA OS evidence</h2>
            </div>
            <small style={{color: "var(--muted)", maxWidth: 360, lineHeight: 1.55}}>
              Museum & History is read-only. Original operational, career, passport and event systems remain authoritative.
            </small>
          </div>

          <div style={{marginTop: 22, display: "grid", gap: 12}}>
            {timeline.length ? (
              timeline.map((item) => (
                <article key={item.id} style={timelineCard}>
                  <div style={timelineDot} aria-hidden="true" />
                  <div style={{minWidth: 0, flex: 1}}>
                    <div style={{display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap"}}>
                      <small style={{...label, color: "#79d9ff"}}>
                        {kindLabel[item.kind] ?? item.kind.toUpperCase()}
                      </small>
                      <time style={{color: "var(--muted)", fontSize: ".82rem"}}>{date(item.occurredAt)}</time>
                    </div>
                    <h3 style={{margin: "8px 0 5px", fontSize: "1.15rem"}}>{item.title}</h3>
                    <p style={{margin: 0, color: "var(--muted)", lineHeight: 1.55}}>{item.description}</p>
                  </div>
                </article>
              ))
            ) : (
              <div style={emptyState}>
                Your legacy timeline will grow as KVA OS records completed flights, milestones, promotions, qualifications and event achievements.
              </div>
            )}
          </div>
        </section>

        <section style={sourceNote}>
          <strong>Read-only Legacy Projection</strong>
          <span style={{color: "var(--muted)"}}>
            This page does not create flight history, award ranks, alter the economy, activate routes or change the fleet.
          </span>
        </section>
        </div>
      </section>
    </main>
  );
}

function Stat({label: statLabel, value}: {label: string; value: string}) {
  return (
    <div style={statCard}>
      <small style={label}>{statLabel}</small>
      <strong style={{display: "block", marginTop: 9, fontSize: "1.55rem"}}>{value}</strong>
    </div>
  );
}

function Memory({
  eyebrow,
  title,
  body,
  footer,
}: {
  eyebrow: string;
  title: string;
  body: string;
  footer: string;
}) {
  return (
    <article style={memoryCard}>
      <small style={{...label, color: "#79d9ff"}}>{eyebrow}</small>
      <h3 style={{margin: "12px 0 8px", fontSize: "1.22rem"}}>{title}</h3>
      <p style={{margin: 0, minHeight: 50, color: "var(--muted)", lineHeight: 1.55}}>{body}</p>
      <div style={{height: 1, background: "var(--border)", margin: "18px 0 13px"}} />
      <small style={{color: "var(--muted)"}}>{footer}</small>
    </article>
  );
}

const hero = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 28,
  flexWrap: "wrap",
  padding: "34px 0 24px",
} as const;

const legacySeal = {
  minWidth: 220,
  padding: "20px 22px",
  border: "1px solid rgba(24,167,224,.28)",
  borderRadius: 20,
  background: "linear-gradient(145deg, rgba(7,43,90,.46), rgba(4,16,32,.52))",
  boxShadow: "0 18px 60px rgba(0,0,0,.16)",
} as const;

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 12,
  marginTop: 14,
} as const;

const statCard = {
  padding: 18,
  border: "1px solid var(--border)",
  borderRadius: 16,
  background: "rgba(4,16,32,.42)",
} as const;

const memoryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
} as const;

const memoryCard = {
  padding: 22,
  border: "1px solid var(--border)",
  borderRadius: 20,
  background:
    "linear-gradient(155deg, rgba(9,35,67,.68), rgba(4,16,32,.58))",
  boxShadow: "0 18px 50px rgba(0,0,0,.12)",
} as const;

const timelineCard = {
  position: "relative",
  display: "flex",
  gap: 18,
  padding: 20,
  border: "1px solid var(--border)",
  borderRadius: 18,
  background: "rgba(4,16,32,.40)",
} as const;

const timelineDot = {
  width: 12,
  height: 12,
  borderRadius: 999,
  marginTop: 5,
  flex: "0 0 auto",
  background: "#18A7E0",
  boxShadow: "0 0 0 5px rgba(24,167,224,.10)",
} as const;

const emptyState = {
  padding: 28,
  border: "1px dashed var(--border)",
  borderRadius: 18,
  color: "var(--muted)",
  lineHeight: 1.65,
} as const;

const sourceNote = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  flexWrap: "wrap",
  marginTop: 40,
  padding: 20,
  border: "1px solid rgba(24,167,224,.20)",
  borderRadius: 18,
  background: "rgba(24,167,224,.055)",
} as const;

const label = {
  fontWeight: 850,
  letterSpacing: ".10em",
  fontSize: ".73rem",
} as const;
