import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Living Memories | KVA OS",
  description: "On This Day, anniversaries and living aviation memories.",
};

type Memory = {
  id: string;
  scope: "pilot" | "company" | string;
  kind: string;
  sourceDate: string;
  yearsAgo?: number;
  nextDate?: string;
  daysUntil?: number;
  anniversaryNumber?: number;
  title: string;
  description: string;
};

type LivingMemoryData = {
  schemaVersion: number;
  projection: string;
  authority: string;
  today: string;
  organizationId?: string | null;
  sourceCount: number;
  journey: {
    startedOn?: string | null;
    days?: number;
    years?: number;
    nextAnniversary?: string | null;
    nextAnniversaryNumber?: number;
  };
  onThisDay: Memory[];
  upcomingAnniversaries: Memory[];
};

function date(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {dateStyle: "medium"}).format(
    new Date(`${value}T12:00:00`),
  );
}

function kindLabel(kind: string) {
  const labels: Record<string, string> = {
    journey_anniversary: "JOURNEY",
    flight_anniversary: "FLIGHT MEMORY",
    milestone_anniversary: "MILESTONE",
    promotion_anniversary: "PROMOTION",
    qualification_anniversary: "QUALIFICATION",
    event_anniversary: "EVENT LEGACY",
    company_anniversary: "AIRLINE HISTORY",
  };
  return labels[kind] ?? kind.replaceAll("_", " ").toUpperCase();
}

function anniversaryText(number?: number) {
  if (!number) return "Anniversary";
  const mod10 = number % 10;
  const mod100 = number % 100;
  const suffix =
    mod10 === 1 && mod100 !== 11
      ? "st"
      : mod10 === 2 && mod100 !== 12
        ? "nd"
        : mod10 === 3 && mod100 !== 13
          ? "rd"
          : "th";
  return `${number}${suffix} anniversary`;
}

export default async function LivingMemoriesPage() {
  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  const {data, error} = await supabase.rpc(
    "get_pilot_museum_living_memories",
  );

  if (error) {
    throw new Error(`Unable to load Living Memories: ${error.message}`);
  }

  const memories = data as unknown as LivingMemoryData;
  const today = Array.isArray(memories?.onThisDay)
    ? memories.onThisDay
    : [];
  const upcoming = Array.isArray(memories?.upcomingAnniversaries)
    ? memories.upcomingAnniversaries
    : [];
  const journey = memories?.journey ?? {};

  return (
    <main
      style={{
        minHeight: "calc(100vh - 80px)",
        padding: "72px 20px 110px",
        background:
          "radial-gradient(circle at 82% 4%, rgba(24,167,224,.18), transparent 30%), radial-gradient(circle at 12% 48%, rgba(7,43,90,.34), transparent 35%), var(--bg)",
      }}
    >
      <div style={{maxWidth: 1180, margin: "0 auto"}}>
        <div style={navRow}>
          <Link className="button outline" href="/pilot/history">
            ← Pilot Museum
          </Link>
          <Link className="button outline" href="/pilot/history/company">
            Airline Museum →
          </Link>
        </div>

        <section style={hero}>
          <div style={{maxWidth: 790}}>
            <p className="eyebrow">KVA OS · PILLAR 09 · LIVING LEGACY</p>
            <h1 style={heroTitle}>Living Memories</h1>
            <p style={heroText}>
              KVA OS does not leave history buried in old records. Important
              flights, milestones, qualifications, achievements and official
              airline history can return when their date comes around again.
            </p>
          </div>

          <div style={clockCard}>
            <small style={label}>YOUR JOURNEY</small>
            <strong style={{display: "block", marginTop: 9, fontSize: "1.55rem"}}>
              {Number(journey.days ?? 0)} days
            </strong>
            <span style={{display: "block", marginTop: 8, color: "var(--muted)"}}>
              Since {date(journey.startedOn)}
            </span>
            <div style={divider} />
            <small style={label}>NEXT JOURNEY ANNIVERSARY</small>
            <strong style={{display: "block", marginTop: 7}}>
              {date(journey.nextAnniversary)}
            </strong>
          </div>
        </section>

        <section style={statsGrid}>
          <Stat label="MEMORY SOURCES" value={String(memories?.sourceCount ?? 0)} />
          <Stat label="ON THIS DAY" value={String(today.length)} />
          <Stat label="UPCOMING" value={String(upcoming.length)} />
          <Stat
            label="REFERENCE DATE"
            value={date(memories?.today)}
            compact
          />
        </section>

        <section style={{marginTop: 42}}>
          <p className="eyebrow">ON THIS DAY</p>
          <h2 style={sectionTitle}>Your aviation past can return today</h2>

          <div style={{display: "grid", gap: 14, marginTop: 20}}>
            {today.length ? (
              today.map((item) => (
                <article key={item.id} style={todayCard}>
                  <div style={memoryIcon}>✦</div>
                  <div style={{minWidth: 0, flex: 1}}>
                    <div style={cardMeta}>
                      <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
                        <small style={{...label, color: "#79d9ff"}}>
                          {kindLabel(item.kind)}
                        </small>
                        <small style={scopeBadge}>
                          {item.scope === "company" ? "AIRLINE" : "PILOT"}
                        </small>
                      </div>
                      <strong style={{color: "#82edb5"}}>
                        {item.yearsAgo === 1
                          ? "1 year ago today"
                          : `${item.yearsAgo} years ago today`}
                      </strong>
                    </div>
                    <h3 style={{margin: "9px 0 5px", fontSize: "1.28rem"}}>
                      {item.title}
                    </h3>
                    <p style={muted}>{item.description}</p>
                  </div>
                </article>
              ))
            ) : (
              <div style={empty}>
                No anniversary falls on today yet. Your KVA OS journey is still
                building its calendar. When a recorded date returns in a future
                year, the memory will appear here automatically.
              </div>
            )}
          </div>
        </section>

        <section style={{marginTop: 44}}>
          <div style={sectionHead}>
            <div>
              <p className="eyebrow">ANNIVERSARY CALENDAR</p>
              <h2 style={sectionTitle}>What the journey will remember next</h2>
            </div>
            <small style={{maxWidth: 390, color: "var(--muted)", lineHeight: 1.55}}>
              Dates come only from recorded KVA OS evidence or a published
              company-history entry with an explicit date.
            </small>
          </div>

          <div style={upcomingGrid}>
            {upcoming.length ? (
              upcoming.map((item) => (
                <article key={item.id} style={upcomingCard}>
                  <div style={cardMeta}>
                    <small style={{...label, color: "#79d9ff"}}>
                      {kindLabel(item.kind)}
                    </small>
                    <small style={scopeBadge}>
                      {item.scope === "company" ? "AIRLINE" : "PILOT"}
                    </small>
                  </div>
                  <h3 style={{margin: "13px 0 7px"}}>{item.title}</h3>
                  <p style={{...muted, minHeight: 48}}>{item.description}</p>
                  <div style={divider} />
                  <strong>{date(item.nextDate)}</strong>
                  <span style={subLine}>
                    {anniversaryText(item.anniversaryNumber)}
                    {typeof item.daysUntil === "number"
                      ? ` · in ${item.daysUntil} days`
                      : ""}
                  </span>
                </article>
              ))
            ) : (
              <div style={empty}>No dated memory sources are available yet.</div>
            )}
          </div>
        </section>

        <section style={integrity}>
          <div>
            <strong>Memories never rewrite history.</strong>
            <p style={{...muted, marginTop: 7}}>
              Living Memories reads existing evidence. It cannot award a rank,
              pay KVC, activate a route, register an aircraft or modify a PIREP.
            </p>
          </div>
          <div style={{textAlign: "right"}}>
            <small style={label}>AUTHORITY</small>
            <strong style={{display: "block", marginTop: 7}}>
              READ-ONLY LEGACY
            </strong>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({
  label: statLabel,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <article style={statCard}>
      <small style={label}>{statLabel}</small>
      <strong
        style={{
          display: "block",
          marginTop: 9,
          fontSize: compact ? "1rem" : "1.55rem",
        }}
      >
        {value}
      </strong>
    </article>
  );
}

const navRow = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 24,
} as const;

const hero = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 28,
  flexWrap: "wrap",
  padding: "24px 0",
} as const;

const heroTitle = {
  margin: "12px 0 14px",
  fontSize: "clamp(3rem, 7vw, 5.8rem)",
  letterSpacing: "-.055em",
} as const;

const heroText = {
  margin: 0,
  color: "var(--muted)",
  fontSize: "1.05rem",
  lineHeight: 1.75,
} as const;

const clockCard = {
  minWidth: 270,
  padding: "22px 24px",
  border: "1px solid rgba(24,167,224,.30)",
  borderRadius: 20,
  background:
    "linear-gradient(145deg, rgba(7,43,90,.54), rgba(4,16,32,.54))",
} as const;

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
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

const todayCard = {
  display: "flex",
  gap: 18,
  padding: 22,
  border: "1px solid rgba(57,220,138,.22)",
  borderRadius: 20,
  background:
    "linear-gradient(145deg, rgba(57,220,138,.07), rgba(4,16,32,.52))",
} as const;

const memoryIcon = {
  width: 40,
  height: 40,
  flex: "0 0 auto",
  display: "grid",
  placeItems: "center",
  borderRadius: 999,
  background: "rgba(24,167,224,.13)",
  color: "#79d9ff",
  fontSize: "1.1rem",
} as const;

const cardMeta = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
} as const;

const scopeBadge = {
  padding: "4px 7px",
  border: "1px solid rgba(121,217,255,.20)",
  borderRadius: 999,
  color: "var(--muted)",
  fontSize: ".64rem",
  fontWeight: 850,
  letterSpacing: ".07em",
} as const;

const upcomingGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: 14,
  marginTop: 20,
} as const;

const upcomingCard = {
  padding: 20,
  border: "1px solid var(--border)",
  borderRadius: 19,
  background:
    "linear-gradient(155deg, rgba(9,35,67,.68), rgba(4,16,32,.58))",
} as const;

const subLine = {
  display: "block",
  marginTop: 5,
  color: "var(--muted)",
  fontSize: ".8rem",
} as const;

const divider = {
  height: 1,
  margin: "15px 0 12px",
  background: "var(--border)",
} as const;

const muted = {
  margin: 0,
  color: "var(--muted)",
  lineHeight: 1.6,
} as const;

const empty = {
  padding: 26,
  border: "1px dashed var(--border)",
  borderRadius: 18,
  color: "var(--muted)",
  lineHeight: 1.65,
} as const;

const sectionHead = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "end",
  gap: 18,
  flexWrap: "wrap",
} as const;

const integrity = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
  flexWrap: "wrap",
  marginTop: 42,
  padding: 22,
  border: "1px solid rgba(24,167,224,.20)",
  borderRadius: 18,
  background: "rgba(24,167,224,.055)",
} as const;

const label = {
  fontWeight: 850,
  letterSpacing: ".10em",
  fontSize: ".72rem",
} as const;
