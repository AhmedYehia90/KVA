import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Airline Museum | KVA OS",
  description: "Company history and airline legacy inside KVA OS.",
};

type TimelineItem = {
  id: string;
  kind: string;
  occurredAt: string | null;
  title: string;
  description: string;
  evidence?: Record<string, unknown>;
};

type MuseumData = {
  schemaVersion: number;
  projection: string;
  authority: string;
  summary: {
    organizationId: string;
    displayName: string;
    founderAirline: boolean;
    companyAssets: number;
    companyEconomicRecords: number;
    reviewedRouteSignals: number;
    publishedCuratedHistory: number;
    firstRecordedActivity?: string | null;
    latestRecordedActivity?: string | null;
    companyEconomy?: {
      currencyCode?: string;
      balance?: number;
      totalIncome?: number;
      totalSpent?: number;
    };
  };
  pilotConnection: {
    evidenceBackedRewardedFlights: number;
    routeSupportContributions: number;
    routeSupportAmount: number;
    firstCompanyEvidenceAt?: string | null;
  };
  timeline: TimelineItem[];
};

const kinds: Record<string, string> = {
  curated_history: "CURATED HISTORY",
  company_asset: "COMPANY ASSET",
  route_signal_review: "OPERATIONS DECISION",
  company_economy: "COMPANY ECONOMY",
};

function date(value?: string | null) {
  if (!value) return "Undated";
  return new Intl.DateTimeFormat("en-GB", {dateStyle: "medium"}).format(new Date(value));
}

function number(value?: number | null) {
  return new Intl.NumberFormat("en-US").format(Number(value ?? 0));
}

export default async function AirlineMuseumPage() {
  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  const {data, error} = await supabase.rpc("get_airline_museum_history");

  if (error) {
    throw new Error(`Unable to load Airline Museum: ${error.message}`);
  }

  const museum = data as unknown as MuseumData;
  const summary = museum?.summary ?? ({} as MuseumData["summary"]);
  const connection = museum?.pilotConnection ?? ({} as MuseumData["pilotConnection"]);
  const timeline = Array.isArray(museum?.timeline) ? museum.timeline : [];

  return (
    <main
      style={{
        minHeight: "calc(100vh - 80px)",
        padding: "72px 20px 110px",
        background:
          "radial-gradient(circle at 82% 5%, rgba(24,167,224,.16), transparent 30%), radial-gradient(circle at 10% 46%, rgba(7,43,90,.34), transparent 35%), var(--bg)",
      }}
    >
      <div style={{maxWidth: 1180, margin: "0 auto"}}>
        <div style={{display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24}}>
          <Link className="button outline" href="/pilot/history">
            ← Pilot Museum
          </Link>
          <Link className="button outline" href="/pilot/history/memories">
            Living Memories
          </Link>
        </div>

        <section style={hero}>
          <div style={{maxWidth: 790}}>
            <p className="eyebrow">KVA OS · PILLAR 09 · AIRLINE LEGACY</p>
            <h1 style={{margin: "12px 0 14px", fontSize: "clamp(3rem, 7vw, 5.8rem)", letterSpacing: "-.055em"}}>
              Airline Museum
            </h1>
            <p style={{margin: 0, color: "var(--muted)", fontSize: "1.05rem", lineHeight: 1.75}}>
              The airline story is built from recorded company evidence and clearly labelled curated history. Operational systems remain the source of truth.
            </p>
          </div>

          <div style={identityCard}>
            <small style={label}>AIRLINE</small>
            <strong style={{display: "block", marginTop: 8, fontSize: "1.35rem"}}>
              {summary.displayName ?? summary.organizationId ?? "Airline"}
            </strong>
            <span style={{display: "block", marginTop: 8, color: "#79d9ff", fontSize: ".82rem", fontWeight: 800}}>
              {summary.founderAirline ? "FOUNDER AIRLINE · FIRST AIRLINE POWERED BY KVA OS" : "KVA OS AIRLINE"}
            </span>
          </div>
        </section>

        <section style={statsGrid}>
          <Stat label="HISTORIC COMPANY ASSETS" value={number(summary.companyAssets)} />
          <Stat label="ECONOMIC RECORDS" value={number(summary.companyEconomicRecords)} />
          <Stat label="ROUTE SIGNAL REVIEWS" value={number(summary.reviewedRouteSignals)} />
          <Stat label="CURATED HISTORY" value={number(summary.publishedCuratedHistory)} />
          <Stat label="FIRST RECORDED ACTIVITY" value={date(summary.firstRecordedActivity)} compact />
          <Stat label="LATEST ACTIVITY" value={date(summary.latestRecordedActivity)} compact />
        </section>

        <section style={{marginTop: 40}}>
          <p className="eyebrow">YOUR PLACE IN THE STORY</p>
          <h2 style={{margin: "8px 0 18px", fontSize: "2rem"}}>Pilot ↔ Airline Legacy Connection</h2>

          <div style={connectionGrid}>
            <div style={connectionCard}>
              <small style={label}>EVIDENCE-BACKED FLIGHTS</small>
              <strong style={bigValue}>{number(connection.evidenceBackedRewardedFlights)}</strong>
              <p style={mutedText}>Flights tied to this organization through Career & Economy evidence.</p>
            </div>

            <div style={connectionCard}>
              <small style={label}>ROUTE SUPPORT ACTIONS</small>
              <strong style={bigValue}>{number(connection.routeSupportContributions)}</strong>
              <p style={mutedText}>Your recorded community-interest contributions to this airline.</p>
            </div>

            <div style={connectionCard}>
              <small style={label}>KVC CONTRIBUTED</small>
              <strong style={bigValue}>{number(connection.routeSupportAmount)} KVC</strong>
              <p style={mutedText}>Historical contribution value only. It does not grant route authority.</p>
            </div>
          </div>
        </section>

        <section style={{marginTop: 44}}>
          <div style={{display: "flex", justifyContent: "space-between", gap: 18, alignItems: "end", flexWrap: "wrap"}}>
            <div>
              <p className="eyebrow">COMPANY LEGACY TIMELINE</p>
              <h2 style={{margin: "8px 0 0", fontSize: "2rem"}}>Evidence becomes history</h2>
            </div>
            <small style={{maxWidth: 410, color: "var(--muted)", lineHeight: 1.55}}>
              Derived items come from existing company systems. Curated items are narrative history and are labelled separately.
            </small>
          </div>

          <div style={{display: "grid", gap: 12, marginTop: 22}}>
            {timeline.length ? (
              timeline.map((item) => {
                const derived = item.evidence?.derived === true;
                return (
                  <article key={item.id} style={timelineCard}>
                    <div style={timelineDot} aria-hidden="true" />
                    <div style={{minWidth: 0, flex: 1}}>
                      <div style={{display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap"}}>
                        <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
                          <small style={{...label, color: "#79d9ff"}}>
                            {kinds[item.kind] ?? item.kind.toUpperCase()}
                          </small>
                          <small style={sourceBadge}>{derived ? "DERIVED" : "CURATED"}</small>
                        </div>
                        <time style={{color: "var(--muted)", fontSize: ".82rem"}}>{date(item.occurredAt)}</time>
                      </div>
                      <h3 style={{margin: "8px 0 5px", fontSize: "1.15rem"}}>{item.title}</h3>
                      <p style={{margin: 0, color: "var(--muted)", lineHeight: 1.6}}>{item.description}</p>
                    </div>
                  </article>
                );
              })
            ) : (
              <div style={emptyState}>
                No company legacy records are visible yet. As company economic assets, reviewed community-interest signals and curated history are recorded, they will appear here.
              </div>
            )}
          </div>
        </section>

        <section style={integrityNote}>
          <div>
            <strong>History is not authority.</strong>
            <p style={{...mutedText, marginTop: 7}}>
              Airline Museum never activates routes, registers aircraft, changes fleet state, alters company balances or rewrites Economy Ledger records.
            </p>
          </div>
          <div style={{textAlign: "right"}}>
            <small style={label}>PROJECTION</small>
            <strong style={{display: "block", marginTop: 7}}>READ-ONLY LEGACY</strong>
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
      <strong style={{display: "block", marginTop: 9, fontSize: compact ? "1rem" : "1.45rem"}}>
        {value}
      </strong>
    </article>
  );
}

const hero = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 28,
  flexWrap: "wrap",
  padding: "26px 0 24px",
} as const;

const identityCard = {
  minWidth: 270,
  maxWidth: 360,
  padding: "22px 24px",
  border: "1px solid rgba(24,167,224,.30)",
  borderRadius: 20,
  background: "linear-gradient(145deg, rgba(7,43,90,.54), rgba(4,16,32,.54))",
} as const;

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
  marginTop: 14,
} as const;

const statCard = {
  minHeight: 86,
  padding: 18,
  border: "1px solid var(--border)",
  borderRadius: 17,
  background: "rgba(4,16,32,.42)",
} as const;

const connectionGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
} as const;

const connectionCard = {
  padding: 22,
  border: "1px solid var(--border)",
  borderRadius: 20,
  background: "linear-gradient(155deg, rgba(9,35,67,.68), rgba(4,16,32,.58))",
} as const;

const bigValue = {
  display: "block",
  marginTop: 10,
  fontSize: "1.8rem",
} as const;

const mutedText = {
  margin: "10px 0 0",
  color: "var(--muted)",
  lineHeight: 1.55,
} as const;

const timelineCard = {
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

const sourceBadge = {
  padding: "3px 7px",
  border: "1px solid rgba(121,217,255,.20)",
  borderRadius: 999,
  color: "var(--muted)",
  fontSize: ".65rem",
  fontWeight: 850,
  letterSpacing: ".07em",
} as const;

const emptyState = {
  padding: 28,
  border: "1px dashed var(--border)",
  borderRadius: 18,
  color: "var(--muted)",
  lineHeight: 1.65,
} as const;

const integrityNote = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
  flexWrap: "wrap",
  marginTop: 40,
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
