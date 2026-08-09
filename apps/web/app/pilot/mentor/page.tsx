import type {Metadata} from "next";
import type {ReactNode} from "react";
import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {
  createMentorGoalAction,
  recordMentorReflectionAction,
  updateMentorGoalStatusAction
} from "./actions";

export const metadata: Metadata = {
  title: "Mentor AI | KVA OS",
  description: "Adaptive evidence-backed pilot mentoring and learning goals."
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type LessonStep = {
  phase: string;
  title: string;
  guidance: string;
  why: string;
};

type GoalRecommendation = {
  category: string;
  title: string;
  objective: string;
  targetCount: number;
  successCodes: string[];
};

type MentorSession = {
  id: string;
  debrief_id: string;
  booking_id: string;
  flight_number: string;
  status: "ready" | "reflected" | "goal_created" | "completed";
  tone: "supportive" | "professional" | "direct";
  confidence: number | string;
  primary_focus_code: string;
  primary_focus: {
    code?: string;
    title?: string;
    message?: string;
    evidence?: Record<string, unknown>;
  };
  opening_message: string;
  diagnosis: string;
  lesson_plan: LessonStep[];
  recommended_goal: GoalRecommendation;
  created_at: string;
  reflected_at: string | null;
};

type MentorReflection = {
  id: string;
  session_id: string;
  response_type: string;
  note: string | null;
  mentor_response: string;
  created_at: string;
};

type MentorGoal = {
  id: string;
  source_session_id: string;
  category: string;
  title: string;
  objective: string;
  status: "active" | "paused" | "completed";
  progress_count: number;
  target_count: number;
  last_progress_reason: string | null;
  created_at: string;
  completed_at: string | null;
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

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function MentorAiPage({
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

  const [sessionsResult, reflectionsResult, goalsResult] = await Promise.all([
    supabase
      .from("mentor_ai_sessions")
      .select(
        "id,debrief_id,booking_id,flight_number,status,tone,confidence,primary_focus_code,primary_focus,opening_message,diagnosis,lesson_plan,recommended_goal,created_at,reflected_at"
      )
      .eq("pilot_id", user.id)
      .order("created_at", {ascending: false})
      .limit(30),
    supabase
      .from("mentor_ai_reflections")
      .select(
        "id,session_id,response_type,note,mentor_response,created_at"
      )
      .eq("pilot_id", user.id)
      .order("created_at", {ascending: false})
      .limit(100),
    supabase
      .from("mentor_ai_goals")
      .select(
        "id,source_session_id,category,title,objective,status,progress_count,target_count,last_progress_reason,created_at,completed_at"
      )
      .eq("pilot_id", user.id)
      .order("created_at", {ascending: false})
      .limit(30)
  ]);

  const firstError =
    sessionsResult.error ??
    reflectionsResult.error ??
    goalsResult.error;

  if (firstError) {
    throw new Error(`Unable to load Mentor AI: ${firstError.message}`);
  }

  const sessions =
    (sessionsResult.data ?? []) as unknown as MentorSession[];
  const reflections =
    (reflectionsResult.data ?? []) as unknown as MentorReflection[];
  const goals =
    (goalsResult.data ?? []) as unknown as MentorGoal[];

  const reflectionsBySession = new Map<string, MentorReflection[]>();

  for (const reflection of reflections) {
    const current = reflectionsBySession.get(reflection.session_id) ?? [];
    current.push(reflection);
    reflectionsBySession.set(reflection.session_id, current);
  }

  const activeGoals = goals.filter((goal) => goal.status === "active");
  const completedGoals = goals.filter(
    (goal) => goal.status === "completed"
  );
  const reflectedSessions = sessions.filter(
    (session) => session.status !== "ready"
  ).length;
  const averageConfidence = sessions.length
    ? Math.round(
        sessions.reduce(
          (sum, session) => sum + Number(session.confidence),
          0
        ) /
          sessions.length *
          100
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
                KVA OS · Pillar 05
              </p>
              <h1 style={{
                margin:"12px 0 18px",
                fontSize:"clamp(3.4rem,8vw,6.3rem)",
                lineHeight:.92,
                letterSpacing:"-.06em"
              }}>
                Mentor AI
              </h1>
              <p style={{
                maxWidth:830,
                margin:0,
                color:"var(--muted)",
                lineHeight:1.8
              }}>
                An adaptive mentor that converts each evidence-backed debrief
                into one practical lesson, records your reflection and tracks
                measurable learning goals across future flights.
              </p>
            </div>

            <Link
              className="button"
              href="/pilot/companion"
              style={{marginTop:8}}
            >
              Open Flight Companion
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
              label="Mentor Sessions"
              value={String(sessions.length)}
              subValue="Generated from debrief evidence"
            />
            <Stat
              label="Reflected"
              value={String(reflectedSessions)}
              subValue="Sessions engaged by pilot"
            />
            <Stat
              label="Active Goals"
              value={String(activeGoals.length)}
              subValue="Measured on future flights"
            />
            <Stat
              label="Completed Goals"
              value={String(completedGoals.length)}
              subValue="Learning milestones"
            />
            <Stat
              label="Confidence"
              value={sessions.length ? `${averageConfidence}%` : "—"}
              subValue="Average evidence coverage"
            />
          </div>

          <section style={panelStyle}>
            <div style={{
              display:"flex",
              justifyContent:"space-between",
              gap:16,
              alignItems:"flex-end",
              flexWrap:"wrap"
            }}>
              <div>
                <p className="eyebrow">Learning Progress</p>
                <h2 style={{margin:"8px 0 0"}}>Mentor Goals</h2>
              </div>
              <span style={mutedStyle}>
                Progress is updated only from later debrief evidence.
              </span>
            </div>

            <div style={{display:"grid",gap:13,marginTop:20}}>
              {goals.length ? goals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              )) : (
                <div style={emptyStyle}>
                  Accept a recommended goal from a mentor session to begin
                  tracking progress.
                </div>
              )}
            </div>
          </section>

          <section style={{display:"grid",gap:20}}>
            <div>
              <p className="eyebrow">Adaptive Coaching</p>
              <h2 style={{margin:"8px 0 0"}}>Mentor Sessions</h2>
            </div>

            {sessions.length ? sessions.map((session) => (
              <MentorSessionCard
                key={session.id}
                session={session}
                reflections={
                  reflectionsBySession.get(session.id) ?? []
                }
                hasOpenGoal={goals.some(
                  (goal) =>
                    goal.source_session_id === session.id &&
                    goal.status !== "completed"
                )}
              />
            )) : (
              <section style={panelStyle}>
                <div style={emptyStyle}>
                  Submit a PIREP to receive a Digital Flight Companion
                  debrief and an adaptive Mentor AI session.
                </div>
              </section>
            )}
          </section>

          <section style={panelStyle}>
            <p className="eyebrow">Trust Boundary</p>
            <h2>What Mentor AI does not invent</h2>
            <p style={{
              margin:"10px 0 0",
              color:"var(--muted)",
              lineHeight:1.8
            }}>
              Mentor AI v1.0 uses the recorded companion debrief and Black Box
              evidence. It does not invent simulator telemetry, navigation
              procedures, VOR instructions, aircraft behaviour or events that
              KVA OS did not record.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}

function GoalCard({goal}: {goal: MentorGoal}) {
  const percent = Math.min(
    100,
    Math.round(goal.progress_count / goal.target_count * 100)
  );

  return (
    <article style={innerPanelStyle}>
      <div style={{
        display:"flex",
        justifyContent:"space-between",
        gap:18,
        alignItems:"flex-start",
        flexWrap:"wrap"
      }}>
        <div style={{maxWidth:760}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Badge value={goal.status} />
            <Badge value={label(goal.category)} />
          </div>
          <h3 style={{margin:"13px 0 7px",fontSize:"1.3rem"}}>
            {goal.title}
          </h3>
          <p style={{margin:0,color:"var(--muted)",lineHeight:1.7}}>
            {goal.objective}
          </p>
        </div>

        <strong style={{fontSize:"1.6rem"}}>
          {goal.progress_count}/{goal.target_count}
        </strong>
      </div>

      <div
        role="progressbar"
        aria-label={`${goal.title} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        style={{
          height:10,
          marginTop:16,
          borderRadius:999,
          overflow:"hidden",
          background:"rgba(255,255,255,.08)"
        }}
      >
        <span style={{
          display:"block",
          width:`${percent}%`,
          height:"100%",
          background:"var(--accent)"
        }} />
      </div>

      <div style={{
        display:"flex",
        justifyContent:"space-between",
        gap:14,
        alignItems:"center",
        flexWrap:"wrap",
        marginTop:14
      }}>
        <small style={{color:"var(--muted)"}}>
          {goal.last_progress_reason ?? "Waiting for the next debrief."}
        </small>

        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {goal.status === "active" ? (
            <GoalStatusForm
              goalId={goal.id}
              status="paused"
              labelText="Pause"
            />
          ) : null}

          {goal.status === "paused" ? (
            <GoalStatusForm
              goalId={goal.id}
              status="active"
              labelText="Resume"
            />
          ) : null}

          {goal.status !== "completed" ? (
            <GoalStatusForm
              goalId={goal.id}
              status="completed"
              labelText="Mark complete"
            />
          ) : (
            <span style={{color:"#98efbf",fontWeight:850}}>
              Completed {formatDate(goal.completed_at)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function GoalStatusForm({
  goalId,
  status,
  labelText
}: {
  goalId:string;
  status:"active" | "paused" | "completed";
  labelText:string;
}) {
  return (
    <form action={updateMentorGoalStatusAction}>
      <input type="hidden" name="goalId" value={goalId} />
      <input type="hidden" name="status" value={status} />
      <button className="button outline" type="submit">
        {labelText}
      </button>
    </form>
  );
}

function MentorSessionCard({
  session,
  reflections,
  hasOpenGoal
}: {
  session: MentorSession;
  reflections: MentorReflection[];
  hasOpenGoal: boolean;
}) {
  const goal = session.recommended_goal ?? {
    category:"consistency",
    title:"Repeat the operational standard",
    objective:"Use the next debrief to verify progress.",
    targetCount:2,
    successCodes:[]
  };
  const confidence = Math.round(Number(session.confidence) * 100);

  return (
    <article style={panelStyle}>
      <div style={{
        display:"flex",
        justifyContent:"space-between",
        gap:20,
        alignItems:"flex-start",
        flexWrap:"wrap"
      }}>
        <div style={{maxWidth:790}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Badge value={session.status} />
            <Badge value={session.tone} />
            <Badge value={`${confidence}% confidence`} />
          </div>

          <p className="eyebrow" style={{marginTop:18}}>
            {session.flight_number}
          </p>
          <h2 style={{margin:"8px 0 10px",fontSize:"2rem"}}>
            {session.primary_focus.title ?? label(session.primary_focus_code)}
          </h2>
          <p style={{
            margin:0,
            color:"var(--muted)",
            lineHeight:1.8,
            fontSize:"1.02rem"
          }}>
            {session.opening_message}
          </p>
        </div>

        <div style={{
          minWidth:175,
          padding:17,
          border:"1px solid var(--border)",
          borderRadius:15,
          background:"rgba(4,16,32,.34)"
        }}>
          <small style={{color:"var(--muted)",fontWeight:850}}>
            CREATED
          </small>
          <strong style={{display:"block",marginTop:8}}>
            {formatDate(session.created_at)}
          </strong>
        </div>
      </div>

      <section style={{...innerPanelStyle,marginTop:20}}>
        <p className="eyebrow">Mentor Diagnosis</p>
        <p style={{margin:"10px 0 0",lineHeight:1.75}}>
          {session.diagnosis}
        </p>
      </section>

      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",
        gap:12,
        marginTop:16
      }}>
        {(session.lesson_plan ?? []).map((step, index) => (
          <article key={`${step.phase}-${index}`} style={innerPanelStyle}>
            <small style={{
              color:"var(--accent)",
              fontWeight:850,
              letterSpacing:".07em"
            }}>
              {step.phase.toUpperCase()}
            </small>
            <h3 style={{margin:"9px 0 7px"}}>{step.title}</h3>
            <p style={{margin:0,color:"var(--muted)",lineHeight:1.65}}>
              {step.guidance}
            </p>
            <details style={{marginTop:11}}>
              <summary style={{
                color:"var(--accent)",
                cursor:"pointer",
                fontWeight:850,
                fontSize:".78rem"
              }}>
                Why this matters
              </summary>
              <p style={{margin:"8px 0 0",lineHeight:1.65}}>
                {step.why}
              </p>
            </details>
          </article>
        ))}
      </div>

      <section style={{...innerPanelStyle,marginTop:16}}>
        <div style={{
          display:"flex",
          justifyContent:"space-between",
          gap:18,
          alignItems:"flex-start",
          flexWrap:"wrap"
        }}>
          <div style={{maxWidth:740}}>
            <p className="eyebrow">Recommended Goal</p>
            <h3 style={{margin:"8px 0 7px"}}>{goal.title}</h3>
            <p style={{margin:0,color:"var(--muted)",lineHeight:1.7}}>
              {goal.objective}
            </p>
            <small style={{
              display:"block",
              marginTop:9,
              color:"var(--accent)"
            }}>
              Target: {goal.targetCount} evidence-backed result
              {goal.targetCount === 1 ? "" : "s"}
            </small>
          </div>

          {hasOpenGoal ? (
            <span style={{color:"#98efbf",fontWeight:850}}>
              Goal already active
            </span>
          ) : (
            <form action={createMentorGoalAction}>
              <input
                type="hidden"
                name="sessionId"
                value={session.id}
              />
              <button className="button" type="submit">
                Accept goal
              </button>
            </form>
          )}
        </div>
      </section>

      <section style={{...innerPanelStyle,marginTop:16}}>
        <p className="eyebrow">Pilot Reflection</p>
        <h3 style={{margin:"8px 0 14px"}}>Talk back to the mentor</h3>

        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <ReflectionButton
            sessionId={session.id}
            responseType="understood"
            labelText="I understand"
          />
          <ReflectionButton
            sessionId={session.id}
            responseType="need_simpler"
            labelText="Explain simpler"
          />
          <ReflectionButton
            sessionId={session.id}
            responseType="need_example"
            labelText="Give an example"
          />
          <ReflectionButton
            sessionId={session.id}
            responseType="ready_to_practice"
            labelText="Ready to practise"
          />
        </div>

        <form
          action={recordMentorReflectionAction}
          style={{
            display:"grid",
            gridTemplateColumns:"1fr auto",
            gap:9,
            marginTop:12
          }}
        >
          <input type="hidden" name="sessionId" value={session.id} />
          <input type="hidden" name="responseType" value="custom" />
          <textarea
            name="note"
            rows={3}
            maxLength={2000}
            required
            placeholder="Write your reflection or question..."
            style={textareaStyle}
          />
          <button className="button" type="submit">
            Send reflection
          </button>
        </form>

        <div style={{display:"grid",gap:10,marginTop:14}}>
          {reflections.length ? reflections.map((reflection) => (
            <article key={reflection.id} style={reflectionStyle}>
              <div style={{
                display:"flex",
                justifyContent:"space-between",
                gap:12,
                flexWrap:"wrap"
              }}>
                <strong>{label(reflection.response_type)}</strong>
                <small style={{color:"var(--muted)"}}>
                  {formatDate(reflection.created_at)}
                </small>
              </div>
              {reflection.note ? (
                <p style={{
                  margin:"9px 0 0",
                  color:"var(--muted)",
                  lineHeight:1.65
                }}>
                  You: {reflection.note}
                </p>
              ) : null}
              <p style={{margin:"9px 0 0",lineHeight:1.7}}>
                Mentor: {reflection.mentor_response}
              </p>
            </article>
          )) : (
            <small style={{color:"var(--muted)"}}>
              No reflection has been recorded for this session.
            </small>
          )}
        </div>
      </section>
    </article>
  );
}

function ReflectionButton({
  sessionId,
  responseType,
  labelText
}: {
  sessionId:string;
  responseType:
    | "understood"
    | "need_simpler"
    | "need_example"
    | "ready_to_practice";
  labelText:string;
}) {
  return (
    <form action={recordMentorReflectionAction}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="responseType" value={responseType} />
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
      {value}
    </span>
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
  padding:17,
  border:"1px solid rgba(105,183,231,.13)",
  borderRadius:15,
  background:"rgba(4,16,32,.28)"
} as const;

const reflectionStyle = {
  padding:14,
  border:"1px solid rgba(105,183,231,.12)",
  borderRadius:12,
  background:"rgba(0,174,239,.055)"
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
