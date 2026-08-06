import type {Metadata} from "next";
import type {ReactNode} from "react";
import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {
  acknowledgeCompanionDebriefAction,
  updateCompanionPreferencesAction
} from "./actions";

export const metadata: Metadata = {
  title: "Digital Flight Companion | KVA OS",
  description: "Evidence-backed pilot debriefs and supportive coaching."
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type CompanionTone = "supportive" | "professional" | "direct";
type DetailLevel = "concise" | "standard" | "detailed";

type DebriefItem = {
  code: string;
  title: string;
  message: string;
  evidence: Record<string, unknown>;
};

type DebriefRow = {
  id: string;
  pirep_id: string;
  booking_id: string;
  flight_number: string;
  status: "ready" | "acknowledged";
  tone: CompanionTone;
  overall_score: number;
  confidence: number | string;
  headline: string;
  summary: string;
  strengths: DebriefItem[];
  focus_items: DebriefItem[];
  metrics: {
    blockMinutes?: number | null;
    plannedBlockMinutes?: number | null;
    blockVarianceMinutes?: number | null;
    blockVariancePercent?: number | null;
    landingRate?: number | null;
    fuelUsedKg?: number | null;
    pirepStatus?: string | null;
  };
  replay_integrity: {
    healthy?: boolean;
    eventCount?: number;
    correlationCount?: number;
    missingCausationLinks?: number;
    unexpectedCausationLinks?: number;
  };
  generated_at: string;
  acknowledged_at: string | null;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function scoreLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Strong";
  if (score >= 65) return "Progressing";
  return "Review";
}

function visibleItems<T>(items: T[], detailLevel: DetailLevel) {
  if (detailLevel === "concise") return items.slice(0, 1);
  if (detailLevel === "standard") return items.slice(0, 3);
  return items;
}

export default async function DigitalFlightCompanionPage({
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

  const [preferencesResult, debriefsResult] = await Promise.all([
    supabase
      .from("pilot_companion_preferences")
      .select("tone,detail_level")
      .eq("pilot_id", user.id)
      .maybeSingle(),
    supabase
      .from("flight_companion_debriefs")
      .select(
        "id,pirep_id,booking_id,flight_number,status,tone,overall_score,confidence,headline,summary,strengths,focus_items,metrics,replay_integrity,generated_at,acknowledged_at"
      )
      .eq("pilot_id", user.id)
      .order("generated_at", {ascending: false})
      .limit(30)
  ]);

  const firstError = preferencesResult.error ?? debriefsResult.error;

  if (firstError) {
    throw new Error(
      `Unable to load Digital Flight Companion: ${firstError.message}`
    );
  }

  const preferences = {
    tone: (preferencesResult.data?.tone ?? "supportive") as CompanionTone,
    detailLevel: (
      preferencesResult.data?.detail_level ?? "standard"
    ) as DetailLevel
  };

  const debriefs =
    (debriefsResult.data ?? []) as unknown as DebriefRow[];

  const readyCount = debriefs.filter(
    (debrief) => debrief.status === "ready"
  ).length;
  const acknowledgedCount = debriefs.filter(
    (debrief) => debrief.status === "acknowledged"
  ).length;
  const averageScore = debriefs.length
    ? Math.round(
        debriefs.reduce(
          (sum, debrief) => sum + debrief.overall_score,
          0
        ) / debriefs.length
      )
    : 0;

  return (
    <main style={{minHeight:"100vh",background:"var(--bg)"}}>
      <section style={{
        padding:"72px 20px 116px",
        background:
          "radial-gradient(circle at 78% 24%,rgba(0,174,239,.25),transparent 30%),linear-gradient(145deg,#06152d,#0b2344 58%,#124d79)"
      }}>
        <div style={{maxWidth:1180,margin:"0 auto"}}>
          <Link
            href="/pilot/dashboard"
            style={{color:"var(--accent)",fontWeight:850}}
          >
            ← Pilot Dashboard
          </Link>

          <p className="eyebrow" style={{marginTop:34}}>
            KVA OS · Pillar 04
          </p>
          <h1 style={{
            margin:"12px 0 18px",
            fontSize:"clamp(3.4rem,8vw,6.3rem)",
            lineHeight:.92,
            letterSpacing:"-.06em"
          }}>
            Digital Flight Companion
          </h1>
          <p style={{
            maxWidth:820,
            margin:0,
            color:"var(--muted)",
            lineHeight:1.8
          }}>
            A supportive, evidence-backed post-flight companion that explains
            what went well, identifies the next focus area and never invents
            simulator data.
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
            gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",
            gap:12
          }}>
            <Stat
              label="Average Score"
              value={debriefs.length ? `${averageScore}/100` : "—"}
              subValue={
                debriefs.length
                  ? scoreLabel(averageScore)
                  : "No debriefs yet"
              }
            />
            <Stat
              label="Debriefs"
              value={String(debriefs.length)}
              subValue="Completed flight reviews"
            />
            <Stat
              label="Ready"
              value={String(readyCount)}
              subValue="Awaiting acknowledgement"
            />
            <Stat
              label="Reviewed"
              value={String(acknowledgedCount)}
              subValue="Acknowledged by pilot"
            />
          </div>

          <section style={panelStyle}>
            <div style={{
              display:"flex",
              justifyContent:"space-between",
              gap:20,
              alignItems:"flex-start",
              flexWrap:"wrap"
            }}>
              <div>
                <p className="eyebrow">Personal Style</p>
                <h2 style={{margin:"8px 0 7px"}}>
                  Companion Preferences
                </h2>
                <p style={{
                  maxWidth:650,
                  margin:0,
                  color:"var(--muted)",
                  lineHeight:1.7
                }}>
                  Your preference applies to future debriefs. Existing flight
                  records remain unchanged.
                </p>
              </div>

              <form
                action={updateCompanionPreferencesAction}
                style={{display:"flex",gap:9,flexWrap:"wrap"}}
              >
                <select
                  name="tone"
                  defaultValue={preferences.tone}
                  style={inputStyle}
                  aria-label="Companion tone"
                >
                  <option value="supportive">Supportive</option>
                  <option value="professional">Professional</option>
                  <option value="direct">Direct</option>
                </select>

                <select
                  name="detailLevel"
                  defaultValue={preferences.detailLevel}
                  style={inputStyle}
                  aria-label="Detail level"
                >
                  <option value="concise">Concise</option>
                  <option value="standard">Standard</option>
                  <option value="detailed">Detailed</option>
                </select>

                <button className="button" type="submit">
                  Save
                </button>
              </form>
            </div>
          </section>

          <section style={{display:"grid",gap:20}}>
            <div>
              <p className="eyebrow">Mentor Debrief</p>
              <h2 style={{margin:"8px 0 0"}}>Post-flight Reviews</h2>
            </div>

            {debriefs.length ? debriefs.map((debrief) => (
              <DebriefCard
                key={debrief.id}
                debrief={debrief}
                detailLevel={preferences.detailLevel}
              />
            )) : (
              <section style={panelStyle}>
                <div style={emptyStyle}>
                  Complete a flight and submit its PIREP to receive your first
                  Digital Flight Companion debrief.
                </div>
              </section>
            )}
          </section>

          <section style={panelStyle}>
            <p className="eyebrow">Trust Boundary</p>
            <h2>What the companion uses</h2>
            <p style={{
              margin:"10px 0 0",
              color:"var(--muted)",
              lineHeight:1.8
            }}>
              Debriefs use recorded landing rate, block time, fuel-data
              completeness and Black Box Replay integrity. Missing telemetry
              is shown as missing; it is never fabricated.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}

function DebriefCard({
  debrief,
  detailLevel
}: {
  debrief: DebriefRow;
  detailLevel: DetailLevel;
}) {
  const strengths = visibleItems(debrief.strengths ?? [], detailLevel);
  const focusItems = visibleItems(
    debrief.focus_items ?? [],
    detailLevel
  );
  const integrity = debrief.replay_integrity ?? {};
  const confidence = Math.round(Number(debrief.confidence) * 100);

  return (
    <article style={panelStyle}>
      <div style={{
        display:"flex",
        justifyContent:"space-between",
        gap:20,
        alignItems:"flex-start",
        flexWrap:"wrap"
      }}>
        <div style={{maxWidth:760}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Badge value={debrief.status} />
            <Badge value={debrief.tone} />
            <Badge value={`${confidence}% confidence`} />
          </div>

          <p className="eyebrow" style={{marginTop:18}}>
            {debrief.flight_number}
          </p>
          <h2 style={{margin:"8px 0 10px",fontSize:"2rem"}}>
            {debrief.headline}
          </h2>
          <p style={{
            margin:0,
            color:"var(--muted)",
            lineHeight:1.8,
            fontSize:"1.02rem"
          }}>
            {debrief.summary}
          </p>
        </div>

        <div style={{
          minWidth:150,
          padding:18,
          border:"1px solid var(--border)",
          borderRadius:16,
          textAlign:"center",
          background:"rgba(4,16,32,.35)"
        }}>
          <small style={{color:"var(--muted)",fontWeight:850}}>
            FLIGHT SCORE
          </small>
          <strong style={{
            display:"block",
            marginTop:8,
            fontSize:"2.4rem"
          }}>
            {debrief.overall_score}
          </strong>
          <span style={{
            display:"block",
            marginTop:4,
            color:"var(--accent)"
          }}>
            {scoreLabel(debrief.overall_score)}
          </span>
        </div>
      </div>

      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",
        gap:16,
        marginTop:22
      }}>
        <section style={innerPanelStyle}>
          <p className="eyebrow">What went well</p>
          <div style={{display:"grid",gap:11,marginTop:14}}>
            {strengths.length ? strengths.map((item) => (
              <DebriefItemCard key={item.code} item={item} positive />
            )) : (
              <p style={mutedStyle}>
                No strength item was generated from the available evidence.
              </p>
            )}
          </div>
        </section>

        <section style={innerPanelStyle}>
          <p className="eyebrow">Focus next flight</p>
          <div style={{display:"grid",gap:11,marginTop:14}}>
            {focusItems.map((item) => (
              <DebriefItemCard key={item.code} item={item} />
            ))}
          </div>
        </section>
      </div>

      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",
        gap:10,
        marginTop:18
      }}>
        <Metric
          label="Block Time"
          value={
            debrief.metrics.blockMinutes == null
              ? "—"
              : `${debrief.metrics.blockMinutes} min`
          }
        />
        <Metric
          label="Planned"
          value={
            debrief.metrics.plannedBlockMinutes == null
              ? "—"
              : `${debrief.metrics.plannedBlockMinutes} min`
          }
        />
        <Metric
          label="Landing Rate"
          value={
            debrief.metrics.landingRate == null
              ? "Not recorded"
              : `${debrief.metrics.landingRate} fpm`
          }
        />
        <Metric
          label="Fuel Used"
          value={
            debrief.metrics.fuelUsedKg == null
              ? "Not recorded"
              : `${debrief.metrics.fuelUsedKg} kg`
          }
        />
        <Metric
          label="Replay"
          value={
            integrity.healthy === true
              ? "Healthy"
              : integrity.healthy === false
                ? "Warning"
                : "Unavailable"
          }
        />
        <Metric
          label="Generated"
          value={formatDate(debrief.generated_at)}
        />
      </div>

      <div style={{
        display:"flex",
        justifyContent:"space-between",
        gap:14,
        alignItems:"center",
        flexWrap:"wrap",
        marginTop:18
      }}>
        <small style={{color:"var(--muted)"}}>
          System integrity notes are not automatically treated as pilot faults.
        </small>

        {debrief.status === "ready" ? (
          <form action={acknowledgeCompanionDebriefAction}>
            <input
              type="hidden"
              name="debriefId"
              value={debrief.id}
            />
            <button className="button" type="submit">
              Acknowledge debrief
            </button>
          </form>
        ) : (
          <span style={{color:"#98efbf",fontWeight:850}}>
            Reviewed {formatDate(debrief.acknowledged_at)}
          </span>
        )}
      </div>
    </article>
  );
}

function DebriefItemCard({
  item,
  positive = false
}: {
  item: DebriefItem;
  positive?: boolean;
}) {
  return (
    <article style={{
      padding:15,
      border:"1px solid rgba(105,183,231,.13)",
      borderRadius:13,
      background:"rgba(4,16,32,.32)"
    }}>
      <strong style={{
        display:"block",
        color:positive ? "#98efbf" : "var(--accent)"
      }}>
        {item.title}
      </strong>
      <p style={{
        margin:"7px 0 0",
        color:"var(--muted)",
        lineHeight:1.65
      }}>
        {item.message}
      </p>

      <details style={{marginTop:10}}>
        <summary style={{
          cursor:"pointer",
          color:"var(--accent)",
          fontSize:".78rem",
          fontWeight:850
        }}>
          Evidence
        </summary>
        <pre style={preStyle}>
          {JSON.stringify(item.evidence, null, 2)}
        </pre>
      </details>
    </article>
  );
}

function Badge({value}: {value:string}) {
  return (
    <span style={{
      padding:"6px 9px",
      borderRadius:999,
      color:"var(--text)",
      background:"rgba(255,255,255,.075)",
      fontSize:".7rem",
      fontWeight:850,
      textTransform:"uppercase"
    }}>
      {value}
    </span>
  );
}

function Metric({label, value}: {label:string; value:string}) {
  return (
    <article style={metricStyle}>
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
  children: ReactNode;
  success?: boolean;
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
  padding:18,
  border:"1px solid rgba(105,183,231,.13)",
  borderRadius:16,
  background:"rgba(4,16,32,.22)"
} as const;

const metricStyle = {
  padding:14,
  border:"1px solid rgba(105,183,231,.13)",
  borderRadius:12,
  background:"rgba(4,16,32,.32)"
} as const;

const emptyStyle = {
  padding:30,
  border:"1px dashed var(--border)",
  borderRadius:14,
  color:"var(--muted)",
  textAlign:"center",
  lineHeight:1.7
} as const;

const mutedStyle = {
  color:"var(--muted)",
  lineHeight:1.7
} as const;

const inputStyle = {
  minHeight:42,
  padding:"0 12px",
  border:"1px solid var(--border)",
  borderRadius:10,
  color:"inherit",
  background:"rgba(4,16,32,.44)"
} as const;

const preStyle = {
  maxHeight:220,
  overflow:"auto",
  margin:"10px 0 0",
  padding:12,
  borderRadius:9,
  color:"#b9d7ef",
  background:"#03101f",
  fontSize:".72rem",
  lineHeight:1.5,
  whiteSpace:"pre-wrap"
} as const;
