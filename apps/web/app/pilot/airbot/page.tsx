import type {Metadata} from "next";
import type {ReactNode} from "react";
import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {askLivingAirbotAction} from "./actions";

export const metadata: Metadata = {
  title: "Living Airbot | KVA OS",
  description: "Live evidence-backed AI Dispatcher for KVA OS pilots."
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type AirbotCheck = {
  code: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  detail: string;
};

type AirbotSession = {
  id: string;
  booking_id: string;
  flight_number: string;
  phase: string;
  readiness: "ready" | "attention" | "blocked";
  readiness_score: number;
  status: "active" | "completed";
  summary: string;
  next_step: string;
  evidence: {
    departure?: string | null;
    arrival?: string | null;
    scheduledMinutes?: number | null;
    bookingStatus?: string;
    dispatchAvailable?: boolean;
    aircraftAssigned?: boolean;
    aircraftRegistration?: string | null;
    aircraftType?: string | null;
    aircraftStatus?: string | null;
    routeActive?: boolean;
  };
  checks: AirbotCheck[];
  updated_at: string;
  completed_at: string | null;
};

type AirbotMessage = {
  id: string;
  session_id: string;
  role: "dispatcher" | "pilot" | "system";
  intent: string | null;
  message: string;
  created_at: string;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default async function LivingAirbotPage({
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

  const [sessionsResult, messagesResult] = await Promise.all([
    supabase
      .from("living_airbot_sessions")
      .select(
        "id,booking_id,flight_number,phase,readiness,readiness_score,status,summary,next_step,evidence,checks,updated_at,completed_at"
      )
      .eq("pilot_id", user.id)
      .order("updated_at", {ascending: false})
      .limit(20),
    supabase
      .from("living_airbot_messages")
      .select("id,session_id,role,intent,message,created_at")
      .eq("pilot_id", user.id)
      .order("created_at", {ascending: false})
      .limit(120)
  ]);

  const firstError = sessionsResult.error ?? messagesResult.error;

  if (firstError) {
    throw new Error(`Unable to load Living Airbot: ${firstError.message}`);
  }

  const sessions =
    (sessionsResult.data ?? []) as unknown as AirbotSession[];
  const messages =
    (messagesResult.data ?? []) as unknown as AirbotMessage[];

  const messagesBySession = new Map<string, AirbotMessage[]>();

  for (const item of messages) {
    const current = messagesBySession.get(item.session_id) ?? [];
    current.push(item);
    messagesBySession.set(item.session_id, current);
  }

  for (const [sessionId, items] of messagesBySession) {
    const ordered = [...items].sort((a, b) => {
      const timeDifference =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

      if (timeDifference !== 0) {
        return timeDifference;
      }

      // Pilot and dispatcher messages created by the same RPC share the same
      // transaction timestamp. Keep the pilot prompt before the response.
      if (a.role === "pilot" && b.role === "dispatcher") return -1;
      if (a.role === "dispatcher" && b.role === "pilot") return 1;

      return 0;
    });

    messagesBySession.set(sessionId, ordered);
  }

  const activeSessions = sessions.filter(
    (session) => session.status === "active"
  );
  const currentSession = activeSessions[0] ?? sessions[0] ?? null;
  const readyCount = sessions.filter(
    (session) => session.readiness === "ready"
  ).length;
  const attentionCount = sessions.filter(
    (session) => session.readiness !== "ready"
  ).length;

  return (
    <main style={{minHeight:"100vh",background:"var(--bg)"}}>
      <section style={{
        padding:"72px 20px 116px",
        background:
          "radial-gradient(circle at 78% 24%,rgba(0,174,239,.28),transparent 30%),linear-gradient(145deg,#06152d,#0b2344 58%,#124d79)"
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
                KVA OS · Pillar 06
              </p>
              <h1 style={{
                margin:"12px 0 8px",
                fontSize:"clamp(3.4rem,8vw,6.3rem)",
                lineHeight:.92,
                letterSpacing:"-.06em"
              }}>
                Living Airbot
              </h1>
              <h2 style={{
                margin:"0 0 18px",
                color:"var(--accent)",
                fontSize:"clamp(1.5rem,3vw,2.3rem)"
              }}>
                AI Dispatcher
              </h2>
              <p style={{
                maxWidth:850,
                margin:0,
                color:"var(--muted)",
                lineHeight:1.8
              }}>
                A live dispatcher that follows each booking through the flight
                lifecycle, explains readiness from recorded KVA OS evidence
                and keeps missing data visible instead of inventing it.
              </p>
            </div>

            <Link
              className="button"
              href="/pilot/flights"
              style={{marginTop:8}}
            >
              Browse Flights
            </Link>
          </div>
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
              label="Dispatch Sessions"
              value={String(sessions.length)}
              subValue="Bookings with Airbot records"
            />
            <Stat
              label="Active"
              value={String(activeSessions.length)}
              subValue="Current flight sessions"
            />
            <Stat
              label="Ready"
              value={String(readyCount)}
              subValue="All recorded checks pass"
            />
            <Stat
              label="Attention"
              value={String(attentionCount)}
              subValue="Visible dispatch items"
            />
            <Stat
              label="Messages"
              value={String(messages.length)}
              subValue="Pilot + dispatcher conversation"
            />
          </div>

          {currentSession ? (
            <SessionCard
              session={currentSession}
              messages={messagesBySession.get(currentSession.id) ?? []}
              current
            />
          ) : (
            <section style={panelStyle}>
              <div style={emptyStyle}>
                Book a flight to open the first Living Airbot dispatch session.
              </div>
            </section>
          )}

          {sessions.length > 1 ? (
            <section style={{display:"grid",gap:16}}>
              <div>
                <p className="eyebrow">Dispatch Archive</p>
                <h2 style={{margin:"8px 0 0"}}>Previous Sessions</h2>
              </div>
              {sessions
                .filter((session) => session.id !== currentSession?.id)
                .map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    messages={messagesBySession.get(session.id) ?? []}
                  />
                ))}
            </section>
          ) : null}

          <section style={panelStyle}>
            <p className="eyebrow">Trust Boundary</p>
            <h2>What Living Airbot knows</h2>
            <p style={{
              margin:"10px 0 0",
              color:"var(--muted)",
              lineHeight:1.8
            }}>
              v1.0 uses the booked route, dispatch record, aircraft assignment,
              fleet state and KVA OS flight events. Weather, ATC instructions,
              navigation procedures and simulator telemetry are not invented.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}

function SessionCard({
  session,
  messages,
  current = false
}: {
  session: AirbotSession;
  messages: AirbotMessage[];
  current?: boolean;
}) {
  const evidence = session.evidence ?? {};
  const checks = session.checks ?? [];

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
            {current ? <Badge value="current" /> : null}
            <Badge value={session.status} />
            <Badge value={session.phase} />
            <Badge value={session.readiness} />
          </div>
          <p className="eyebrow" style={{marginTop:18}}>
            {session.flight_number}
          </p>
          <h2 style={{margin:"8px 0 10px",fontSize:"2rem"}}>
            {session.summary}
          </h2>
          <p style={{margin:0,color:"var(--muted)",lineHeight:1.75}}>
            Next: {session.next_step}
          </p>
        </div>

        <div style={{
          minWidth:160,
          padding:18,
          border:"1px solid var(--border)",
          borderRadius:16,
          textAlign:"center",
          background:"rgba(4,16,32,.35)"
        }}>
          <small style={{color:"var(--muted)",fontWeight:850}}>
            READINESS
          </small>
          <strong style={{
            display:"block",
            marginTop:8,
            fontSize:"2.4rem"
          }}>
            {session.readiness_score}%
          </strong>
          <span style={{
            display:"block",
            marginTop:4,
            color:"var(--accent)"
          }}>
            {label(session.readiness)}
          </span>
        </div>
      </div>

      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",
        gap:10,
        marginTop:18
      }}>
        <Metric label="Route" value={`${evidence.departure ?? "—"} → ${evidence.arrival ?? "—"}`} />
        <Metric label="Planned" value={evidence.scheduledMinutes == null ? "Not recorded" : `${evidence.scheduledMinutes} min`} />
        <Metric label="Aircraft" value={evidence.aircraftRegistration ?? "Pending"} />
        <Metric label="Type" value={evidence.aircraftType ?? "—"} />
        <Metric label="Fleet State" value={evidence.aircraftStatus ?? "Pending"} />
        <Metric label="Updated" value={formatDate(session.updated_at)} />
      </div>

      <section style={{...innerPanelStyle,marginTop:18}}>
        <p className="eyebrow">Dispatch Checks</p>
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",
          gap:10,
          marginTop:13
        }}>
          {checks.map((check) => (
            <article key={check.code} style={checkStyle}>
              <div style={{
                display:"flex",
                justifyContent:"space-between",
                gap:10
              }}>
                <strong>{check.label}</strong>
                <span style={{
                  color:check.passed ? "#98efbf" : "#ffb1b1",
                  fontWeight:850
                }}>
                  {check.passed ? "PASS" : check.blocking ? "BLOCK" : "ATTN"}
                </span>
              </div>
              <p style={{
                margin:"8px 0 0",
                color:"var(--muted)",
                lineHeight:1.6
              }}>
                {check.detail}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section style={{...innerPanelStyle,marginTop:18}}>
        <p className="eyebrow">Talk to Airbot</p>
        <h3 style={{margin:"8px 0 14px"}}>Live AI Dispatcher</h3>

        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <QuickAsk sessionId={session.id} intent="briefing" labelText="Brief me" />
          <QuickAsk sessionId={session.id} intent="readiness" labelText="Readiness" />
          <QuickAsk sessionId={session.id} intent="aircraft" labelText="Aircraft" />
          <QuickAsk sessionId={session.id} intent="next_step" labelText="Next step" />
        </div>

        <form
          action={askLivingAirbotAction}
          style={{
            display:"grid",
            gridTemplateColumns:"1fr auto",
            gap:9,
            marginTop:12
          }}
        >
          <input type="hidden" name="sessionId" value={session.id} />
          <input type="hidden" name="intent" value="custom" />
          <textarea
            name="message"
            rows={3}
            maxLength={2000}
            required
            placeholder="Ask about the recorded dispatch, route, aircraft or readiness..."
            style={textareaStyle}
          />
          <button className="button" type="submit">
            Ask Airbot
          </button>
        </form>

        <div style={{display:"grid",gap:9,marginTop:15}}>
          {messages.length ? messages.map((item) => (
            <article key={item.id} style={{
              ...messageStyle,
              marginLeft:item.role === "pilot" ? "9%" : 0,
              marginRight:item.role === "dispatcher" ? "9%" : 0
            }}>
              <div style={{
                display:"flex",
                justifyContent:"space-between",
                gap:10,
                flexWrap:"wrap"
              }}>
                <strong>
                  {item.role === "dispatcher" ? "Living Airbot" : "You"}
                </strong>
                <small style={{color:"var(--muted)"}}>
                  {formatDate(item.created_at)}
                </small>
              </div>
              <p style={{margin:"8px 0 0",lineHeight:1.7}}>
                {item.message}
              </p>
            </article>
          )) : (
            <small style={{color:"var(--muted)"}}>
              No dispatcher conversation has been recorded yet.
            </small>
          )}
        </div>
      </section>
    </article>
  );
}

function QuickAsk({
  sessionId,
  intent,
  labelText
}: {
  sessionId:string;
  intent:"briefing" | "readiness" | "aircraft" | "next_step";
  labelText:string;
}) {
  return (
    <form action={askLivingAirbotAction}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="intent" value={intent} />
      <button className="button outline" type="submit">
        {labelText}
      </button>
    </form>
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
      {label(value)}
    </span>
  );
}

function Metric({label:labelText,value}: {label:string;value:string}) {
  return (
    <article style={metricStyle}>
      <small style={{color:"var(--muted)",fontWeight:850}}>
        {labelText.toUpperCase()}
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
  label:labelText,
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
        {labelText.toUpperCase()}
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

const checkStyle = {
  padding:14,
  border:"1px solid rgba(105,183,231,.12)",
  borderRadius:12,
  background:"rgba(4,16,32,.34)"
} as const;

const messageStyle = {
  padding:14,
  border:"1px solid rgba(105,183,231,.12)",
  borderRadius:12,
  background:"rgba(0,174,239,.055)"
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

const textareaStyle = {
  width:"100%",
  minHeight:86,
  padding:13,
  border:"1px solid var(--border)",
  borderRadius:12,
  color:"inherit",
  background:"rgba(4,16,32,.44)",
  resize:"vertical"
} as const;
